import React, { useState, useContext } from 'react';
import { auth, googleProvider } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithPopup } from 'firebase/auth';
import { AppContext } from '../context/AppContext.jsx';

export default function Login() {
  const { gradText, gradBtn } = useContext(AppContext);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleLogin = async () => {
    if (!email || !senha) return alert("Preencha e-mail e senha");
    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (error) {
      alert("Erro ao entrar: Verifique se o e-mail e a senha estão corretos.");
    }
  };

  const handleCadastro = async () => {
    if (!email || !senha) return alert("Preencha e-mail e senha");
    if (senha.length < 6) return alert("A senha deve ter pelo menos 6 caracteres.");
    try {
      await createUserWithEmailAndPassword(auth, email, senha);
    } catch (error) {
      alert("Erro ao cadastrar: " + error.message);
    }
  };

  const handleRecuperarSenha = async () => {
    if (!email) return alert("Digite o seu e-mail acima para recuperar a senha.");
    try {
      await sendPasswordResetEmail(auth, email);
      alert("✅ E-mail de recuperação enviado!");
    } catch (error) {
      alert("Erro ao enviar e-mail: Verifique se o e-mail está correto.");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      alert("Erro ao entrar com Google: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-sky-500 rounded-full mix-blend-screen filter blur-[120px] opacity-20"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-emerald-400 rounded-full mix-blend-screen filter blur-[100px] opacity-20"></div>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-10">
          <h1 className={`text-6xl font-black mb-2 tracking-tight ${gradText} drop-shadow-sm`}>Mão Na Água</h1>
          <p className="text-teal-200/60 font-medium tracking-widest uppercase text-[10px] mt-3">Plataforma de Gestão Profissional</p>
        </div>

        <div className="bg-zinc-900/60 p-8 rounded-[2rem] border border-zinc-800 shadow-2xl backdrop-blur-md">
          <h2 className="text-xl font-bold mb-8 text-zinc-100">{isRegistering ? 'Criar Nova Conta' : 'Aceda à sua aplicação'}</h2>

          <div className="space-y-5">
            <div>
              <label className="text-[10px] font-bold text-teal-500 uppercase tracking-wider ml-2">E-mail</label>
              <input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-zinc-950/80 border border-zinc-800 p-4 rounded-2xl outline-none focus:border-teal-400 text-white transition-colors mt-1" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-teal-500 uppercase tracking-wider ml-2">Senha</label>
              <input type="password" placeholder="Mínimo 6 caracteres" value={senha} onChange={e => setSenha(e.target.value)} className="w-full bg-zinc-950/80 border border-zinc-800 p-4 rounded-2xl outline-none focus:border-teal-400 text-white transition-colors mt-1" />
            </div>

            <button onClick={isRegistering ? handleCadastro : handleLogin} className={`w-full py-4 rounded-2xl font-bold mt-6 text-lg ${gradBtn}`}>
              {isRegistering ? 'CADASTRAR E ENTRAR' : 'ENTRAR'}
            </button>

            <button onClick={handleGoogleLogin} className="w-full py-4 rounded-2xl font-bold mt-3 bg-white text-zinc-900 shadow-md flex items-center justify-center gap-3 hover:bg-zinc-100 transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continuar com o Google
            </button>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <button onClick={() => setIsRegistering(!isRegistering)} className="text-sm text-zinc-400 font-medium hover:text-teal-400 transition-colors">
              {isRegistering ? 'Já tem uma conta? Faça login' : 'Não tem conta? Cadastre-se'}
            </button>

            {!isRegistering && (
              <button onClick={handleRecuperarSenha} className="text-xs text-zinc-500 font-medium hover:text-sky-400 transition-colors underline underline-offset-4">
                Esqueci minha senha
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
