addEventListener('syncTask', async (resolve, reject, args) => {
  try {
    console.log('Mão na Água: Background sync started');
    // Este runner permite que o sistema mantenha o processo vivo
    // por alguns minutos para concluir tarefas pendentes.
    resolve();
  } catch (error) {
    reject(error);
  }
});
