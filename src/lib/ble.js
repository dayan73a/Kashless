# Crear archivo ble.js MOCKED
cat > src/lib/ble.js << 'EOF'
// MOCK: Simulación de Bluetooth para desarrollo
let simulationMode = true;

export const activateMachine = async (cents) => {
  const command = `CENTS:${cents}`;
  console.log(`🎮 MODO SIMULACIÓN: Enviando ${command}`);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('✅ Activación simulada exitosa');
      resolve(true);
    }, 1000);
  });
};

export const checkBluetoothStatus = async () => {
  return { 
    status: 'simulation', 
    message: 'Modo simulación activado' 
  };
};
EOF