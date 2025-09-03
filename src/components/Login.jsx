import { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, addDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
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
          comision_porcentaje: 3,
          moneda: "MXN"
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
        setError('Por favor completa todos los campos del negocio');
        setCargando(false);
        return;
      }

      // 1. PRIMERO crear el usuario en Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      let negocioId = null;
      
      if (esDueno) {
        // 2. LUEGO crear el negocio y obtener su ID
        negocioId = await crearNegocio(user.uid, email);
      }

      // 3. FINALMENTE crear el documento del usuario en Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email: email,
        saldo_general: 0,
        es_dueno: esDueno,        // ← Valor correcto
        negocio_id: negocioId,    // ← ID del negocio o null
        fecha_creacion: new Date()
      });
      
      alert(esDueno ? '¡Negocio registrado con éxito! 🎉' : 'Usuario registrado con éxito! 🎉');
      navigate('/dashboard');
    } catch (error) {
      console.error("Error completo en registro:", error);
      setError('Error: ' + error.message);
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

      // Verificar si existe en Firestore, sino crearlo
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        // Crear documento básico para usuarios que vienen de Authentication pero no tienen documento
        await setDoc(userDocRef, {
          email: user.email,
          saldo_general: 0,
          es_dueno: false, // Por defecto es cliente
          fecha_creacion: new Date()
        });
        console.log("Documento de usuario creado automáticamente");
      }

      navigate('/dashboard');
    } catch (error) {
      setError('Error: ' + error.message);
    } finally {
      setCargando(false);
    }
  };

  const togglePasswordVisibility = () => {
    setMostrarPassword(!mostrarPassword);
  };

  // VISTA DE LOGIN (NO REGISTRO)
  if (!estaRegistrando) {
    return (
      <div className="login-container">
        <div className="login-header">
          <h1>Kashless</h1>
          <p>Sistema de pagos para negocios</p>
        </div>
        
        <div className="login-form">
          {error && <div className="error-message">{error}</div>}
          
          <h2>Iniciar Sesión</h2>
          
          <div className="form-group">
            <div className="input-with-icon">
              <i className="fas fa-envelope"></i>
              <input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={cargando}
              />
            </div>
          </div>
          
          <div className="form-group">
            <div className="input-with-icon password-field">
              <i className="fas fa-lock"></i>
              <input
                type={mostrarPassword ? "text" : "password"}
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={cargando}
              />
              <span className="toggle-password" onClick={togglePasswordVisibility}>
                <i className={`fas ${mostrarPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
              </span>
            </div>
          </div>
          
          <button 
            className="btn btn-primary" 
            onClick={handleLogin}
            disabled={cargando}
          >
            {cargando ? "Ingresando..." : "Ingresar a mi cuenta"}
          </button>
          
          <div className="divider">
            <span className="divider-text">o</span>
          </div>
          
          <button 
            className="btn btn-secondary" 
            onClick={() => setEstaRegistrando(true)}
            disabled={cargando}
          >
            Crear cuenta nueva
          </button>
        </div>
      </div>
    );
  }

  // VISTA DE REGISTRO
  return (
    <div className="login-container">
      <div className="login-header">
        <h1>Kashless</h1>
        <p>Sistema de pagos para negocios</p>
      </div>
      
      <div className="login-form">
        {error && <div className="error-message">{error}</div>}
        
        <h2>{esDueno ? 'Registrar mi negocio' : 'Crear cuenta de cliente'}</h2>
        
        <div className="toggle-container">
          <button
            className={!esDueno ? "toggle-button active" : "toggle-button"}
            onClick={() => setEsDueno(false)}
          >
            👤 Soy Cliente
          </button>
          <button
            className={esDueno ? "toggle-button active" : "toggle-button"}
            onClick={() => setEsDueno(true)}
          >
            🏪 Tengo un Negocio
          </button>
        </div>

        <div className="form-group">
          <div className="input-with-icon">
            <i className="fas fa-envelope"></i>
            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={cargando}
            />
          </div>
        </div>
        
        <div className="form-group">
          <div className="input-with-icon password-field">
            <i className="fas fa-lock"></i>
            <input
              type={mostrarPassword ? "text" : "password"}
              placeholder="Contraseña (mínimo 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={cargando}
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
              <h3>Información del Negocio</h3>
            </div>
            
            <div className="form-group">
              <input
                type="text"
                placeholder="Nombre de tu negocio"
                value={nombreNegocio}
                onChange={(e) => setNombreNegocio(e.target.value)}
                disabled={cargando}
              />
            </div>
            
            <div className="formgroup">
              <input
                type="text"
                placeholder="Dirección completa"
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
                <option value="lavanderia">🧺 Lavandería</option>
                <option value="cafeteria">☕ Cafetería</option>
                <option value="restaurante">🍽️ Restaurante</option>
                <option value="tienda">🛒 Tienda</option>
                <option value="barberia">✂️ Barbería</option>
                <option value="otros">🏪 Otro tipo de negocio</option>
              </select>
            </div>
          </div>
        )}

        <button 
          className="btn btn-primary"
          onClick={handleRegister}
          disabled={cargando}
        >
          {cargando ? "Creando cuenta..." : (esDueno ? "Registrar mi negocio" : "Crear cuenta")}
        </button>
        
        <button 
          className="btn btn-text"
          onClick={() => setEstaRegistrando(false)}
          disabled={cargando}
        >
          ← Volver al inicio de sesión
        </button>
      </div>
    </div>
  );
};

export default Login;