import React, { useState } from 'react';

// Estilos embutidos para não depender de configuração externa
const styles = {
  container: { padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#f3f4f6', minHeight: '100vh' },
  card: { backgroundColor: 'white', padding: '15px', borderRadius: '12px', marginBottom: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  title: { color: '#1e3a8a', fontSize: '28px', fontWeight: 'bold', textAlign: 'center', marginBottom: '5px' },
  button: { backgroundColor: '#3b82f6', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' },
  badge: { backgroundColor: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 'bold' },
  clientName: { fontSize: '18px', fontWeight: 'bold', color: '#374151' },
  address: { fontSize: '14px', color: '#6b7280', marginBottom: '10px' }
};

export default function App() {
  const [clientes] = useState([
    { id: 1, nome: 'Dona Maria', bairro: 'Centro', status: 'Pendente' },
    { id: 2, nome: 'Condomínio Solar', bairro: 'Bairro das Acácias', status: 'Pendente' }
  ]);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Mão Na Água</h1>
      <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '20px' }}>Pool Service - Jataí</p>
      
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '15px' }}>📅 Limpar Hoje</h2>
        
        {clientes.map(cliente => (
          <div key={cliente.id} style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={styles.clientName}>{cliente.nome}</span>
              <span style={styles.badge}>{cliente.status}</span>
            </div>
            <p style={styles.address}>📍 {cliente.bairro}</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={styles.button}>Iniciar Limpeza</button>
              <button style={{ ...styles.button, backgroundColor: '#ef4444' }}>Adiar</button>
            </div>
          </div>
        ))}

        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <button style={{ ...styles.button, backgroundColor: '#1f2937', width: '100%' }}>
            📋 Gerar Novo Relatório
          </button>
        </div>
      </div>
    </div>
  );
}