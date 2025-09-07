// src/components/Login.jsx
import { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, addDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useI18n } from '../context/I18nContext.jsx';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [esDueno, setEsDueno] = useState(false);
  const [nombreNegocio, setNombreNegocio] = useState('');
  const [direccionNegocio, setDireccionNegocio] = useState('');
  const [tipoNegocio, setTipoNegocio] = useState('lavanderia');
  const [estaRegistrando, setEstaRegistrando] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const navigate = useNavigate();
  const { appConfig } = useApp();
  const { t, lang } = useI18n();
  const isEN = lang === 'en';

  // Utilidad: usa t() si existe la clave; si no, usa fallback
  const tt = (key, fallback) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  const logoPath = appConfig?.app_logo || "/logo.png";

  const crearNegocio = async (userId, userEmail) => {
    try {
      console.log("Creando negocio para:", userEmail);
      const negocioRef = await addDoc(collection(db, 'businesses'), {
        nombre: nombreNegocio,
        direccion: direccionNegocio,
        tipo: tipoNegocio,
        dueño_id: userId,
        dueño_email: userEmail,
        comision_accumulada: 0,
        saldo_disponible: 0,
        fecha_creacion: new Date(),
        activo: true,
        configuracion: {
          comision_porcentaje: 3, // puedes ajustarlo luego en el panel
          moneda: "USD"
        }
      });
      console.log("Negocio creado con ID:", negocioRef.id);
      return negocioRef.id;
    } catch (error) {
      console.error("Error detallado creando negocio:", error);
      throw error;
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError('');
    try {
      if (esDueno && (!nombreNegocio || !direccionNegocio)) {
        setError(isEN ? 'Please complete all business fields' : 'Por favor completa todos los campos del negocio');
        setCargando(false);
        return;
      }

      // 1) Crear usuario en Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2) Crear negocio si corresponde
      let negocioId = null;
      if (esDueno) {
        negocioId = await crearNegocio(user.uid, email);
      }

      // 3) Crear documento de usuario en Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email,
        saldo_general: 0,
        es_dueno: esDueno,
        negocio_id: negocioId,
        fecha_creacion: new Date()
      });

      alert(esDueno
        ? (isEN ? 'Business registered successfully! 🎉' : '¡Negocio registrado con éxito! 🎉')
        : (isEN ? 'User registered successfully! 🎉' : '¡Usuario registrado con éxito! 🎉')
      );
      navigate('/dashboard');
    } catch (error) {
      console.error("Error completo en registro:", error);
      setError((isEN ? 'Error: ' : 'Error: ') + error.message);
    } finally {
      setCargando(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Garantiza doc en Firestore si no existe
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          email: user.email,
          saldo_general: 0,
          es_dueno: false,
          fecha_creacion: new Date()
        });
        console.log("Documento de usuario creado automáticamente");
      }

      navigate('/dashboard');
    } catch (error) {
      setError((isEN ? 'Error: ' : 'Error: ') + error.message);
    } finally {
      setCargando(false);
    }
  };

  const togglePasswordVisibility = () => setMostrarPassword(!mostrarPassword);

  // VISTA LOGIN
  if (!estaRegistrando) {
    return (
      <div className="login-container">
        <div className="login-header">
          {/* Si quieres usar logo: <img src={logoPath} alt="Kashless" style={{height:40}} /> */}
          <h1>Kashless</h1>
          <p>{tt('login.subtitle', 'Sistema de pagos para negocios')}</p>
        </div>

        <div className="login-form">
          {error && <div className="error-message">{error}</div>}

          <h2>{isEN ? 'Sign in' : 'Iniciar Sesión'}</h2>


          <div className="form-group">
            <div className="input-with-icon">
              <i className="fas fa-envelope"></i>
              <input
                type="email"
                placeholder={isEN ? "Email" : "Correo electrónico"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={cargando}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <div className="input-with-icon password-field">
              <i className="fas fa-lock"></i>
              <input
                type={mostrarPassword ? "text" : "password"}
                placeholder={isEN ? "Password" : "Contraseña"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={cargando}
                autoComplete="current-password"
              />
              <span className="toggle-password" onClick={togglePasswordVisibility}>
                <i className={`fas ${mostrarPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
              </span>
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleLogin} disabled={cargando}>
            {cargando ? (isEN ? "Signing in..." : "Ingresando...") : (isEN ? "Sign in" : "Ingresar a mi cuenta")}
          </button>

          <div className="divider">
            <span className="divider-text">{tt('login.or', 'o')}</span>
          </div>

          <button className="btn btn-secondary" onClick={() => setEstaRegistrando(true)} disabled={cargando}>
            {isEN ? "Create new account" : "Crear cuenta nueva"}
          </button>
        </div>
      </div>
    );
  }

  // VISTA REGISTRO
  return (
    <div className="login-container">
      <div className="login-header">
        <h1>Kashless</h1>
        <p>{tt('login.subtitle', 'Sistema de pagos para negocios')}</p>
      </div>

      <div className="login-form">
        {error && <div className="error-message">{error}</div>}

        <h2>
          {esDueno
            ? (isEN ? 'Register my business' : 'Registrar mi negocio')
            : (isEN ? 'Create customer account' : 'Crear cuenta de cliente')}
        </h2>

        <div className="toggle-container">
          <button
            className={!esDueno ? "toggle-button active" : "toggle-button"}
            onClick={() => setEsDueno(false)}
          >
            {isEN ? "👤 I’m a Customer" : "👤 Soy Cliente"}
          </button>
          <button
            className={esDueno ? "toggle-button active" : "toggle-button"}
            onClick={() => setEsDueno(true)}
          >
            {isEN ? "🏪 I have a Business" : "🏪 Tengo un Negocio"}
          </button>
        </div>

        <div className="form-group">
          <div className="input-with-icon">
            <i className="fas fa-envelope"></i>
            <input
              type="email"
              placeholder={isEN ? "Email" : "Correo electrónico"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={cargando}
              autoComplete="email"
            />
          </div>
        </div>

        <div className="form-group">
          <div className="input-with-icon password-field">
            <i className="fas fa-lock"></i>
            <input
              type={mostrarPassword ? "text" : "password"}
              placeholder={isEN ? "Password (min 6 chars)" : "Contraseña (mínimo 6 caracteres)"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={cargando}
              autoComplete="new-password"
            />
            <span className="toggle-password" onClick={togglePasswordVisibility}>
              <i className={`fas ${mostrarPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
            </span>
          </div>
        </div>

        {esDueno && (
          <div className="negocio-section">
            <div className="section-header">
              <span className="section-icon">🏪</span>
              <h3>{isEN ? "Business Information" : "Información del Negocio"}</h3>
            </div>

            <div className="form-group">
              <input
                type="text"
                placeholder={isEN ? "Business name" : "Nombre de tu negocio"}
                value={nombreNegocio}
                onChange={(e) => setNombreNegocio(e.target.value)}
                disabled={cargando}
              />
            </div>

            <div className="formgroup">
              <input
                type="text"
                placeholder={isEN ? "Full address" : "Dirección completa"}
                value={direccionNegocio}
                onChange={(e) => setDireccionNegocio(e.target.value)}
                disabled={cargando}
              />
            </div>

            <div className="form-group">
              <select
                value={tipoNegocio}
                onChange={(e) => setTipoNegocio(e.target.value)}
                disabled={cargando}
              >
                <option value="lavanderia">{isEN ? "🧺 Laundromat" : "🧺 Lavandería"}</option>
                <option value="cafeteria">{isEN ? "☕ Coffee shop" : "☕ Cafetería"}</option>
                <option value="restaurante">{isEN ? "🍽️ Restaurant" : "🍽️ Restaurante"}</option>
                <option value="tienda">{isEN ? "🛒 Store" : "🛒 Tienda"}</option>
                <option value="barberia">{isEN ? "✂️ Barbershop" : "✂️ Barbería"}</option>
                <option value="otros">{isEN ? "🏪 Other business" : "🏪 Otro tipo de negocio"}</option>
              </select>
            </div>
          </div>
        )}

        <button className="btn btn-primary" onClick={handleRegister} disabled={cargando}>
          {cargando
            ? (isEN ? "Creating account..." : "Creando cuenta...")
            : (esDueno ? (isEN ? "Register my business" : "Registrar mi negocio")
                        : (isEN ? "Create account" : "Crear cuenta"))}
        </button>

        <button className="btn btn-text" onClick={() => setEstaRegistrando(false)} disabled={cargando}>
          {isEN ? "← Back to sign in" : "← Volver al inicio de sesión"}
        </button>
      </div>
    </div>
  );
};

export default Login;
