export const prepararTelefoneWhatsApp = (telefone) => {
  let numero = String(telefone || '').replace(/\D/g, '');

  // O código 55 pode ser tanto o DDI do Brasil como o DDD de algumas
  // cidades. Só removemos o DDI quando o número já tem 12 ou 13 dígitos.
  if (numero.startsWith('55') && (numero.length === 12 || numero.length === 13)) {
    numero = numero.slice(2);
  }

  if (!/^\d{10,11}$/.test(numero)) return null;
  return `55${numero}`;
};

export const abrirWhatsApp = (telefone, mensagem) => {
  const numero = prepararTelefoneWhatsApp(telefone);
  if (!numero) return false;

  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`, '_blank');
  return true;
};
