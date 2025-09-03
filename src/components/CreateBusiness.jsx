// En /src/pages/CreateBusiness.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase'; // Ajusta la ruta según tu estructura
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';
import { useAppContext } from '../context/AppContext'; // Ajusta la ruta

const CreateBusiness = () => {
  const { currentUser } = useAppContext();
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessType, setBusinessType] = useState('lavanderia');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!businessName.trim() || !businessAddress.trim()) return;
    setIsLoading(true);

    try {
      // 1. Crear el documento del negocio en la colección 'businesses'
      const newBusinessRef = doc(collection(db, 'businesses'));
      await setDoc(newBusinessRef, {
        nombre: businessName,
        direccion: businessAddress,
        tipo: businessType,
        dueño_id: currentUser.uid, // Asegúrate de que currentUser tenga uid
        dueño_email: currentUser.email,
        comision_accumulada: 0,
        saldo_disponible: 0,
        activo: true
      });

      const newBusinessId = newBusinessRef.id; // Este es el ID único del negocio

      // 2. ¡CRUCIAL! Actualizar el documento del usuario con el negocio_id
      const userDocRef = doc(db, 'users', currentUser.uid);
      await setDoc(userDocRef, { 
        negocio_id: newBusinessId 
      }, { merge: true }); // Usa merge: true para no sobreescribir otros campos

      console.log("✅ Negocio creado y usuario actualizado con ID:", newBusinessId);
      alert('¡Negocio creado con éxito!');
      navigate('/business-dashboard'); // Redirige de vuelta al panel

    } catch (error) {
      console.error("Error creando negocio:", error);
      alert('Error al crear el negocio: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="create-business-container">
      <h2>Crear Tu Negocio</h2>
      <p>Como socio, necesitas registrar tu negocio para comenzar.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Nombre del Negocio"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Dirección"
          value={businessAddress}
          onChange={(e) => setBusinessAddress(e.target.value)}
          required
        />
        <select value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
          <option value="lavanderia">Lavandería</option>
          <option value="cafeteria">Cafetería</option>
          <option value="restaurante">Restaurante</option>
          <option value="tienda">Tienda</option>
          <option value="otros">Otros</option>
        </select>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Creando...' : 'Crear Negocio'}
        </button>
      </form>
    </div>
  );
};

export default CreateBusiness;