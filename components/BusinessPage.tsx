import React from 'react';

interface BusinessPageProps {
  onBack: () => void;
  onContact: () => void;
}

const BusinessPage: React.FC<BusinessPageProps> = ({ onBack, onContact }) => {
  return (
    <div className="w-full bg-[#050505] text-white overflow-hidden font-['Montserrat']">
      
      {/* --- NAVIGATION BAR (FIXED) --- */}
      <nav className="fixed top-0 w-full z-50 px-6 py-4 flex justify-between items-center bg-[#050505]/80 backdrop-blur-md border-b border-white/10">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={onBack}>
            <div className="w-8 h-8 bg-cyan-600 skew-x-[-12deg] flex items-center justify-center shadow-[0_0_10px_rgba(0,212,255,0.5)]">
              <span className="font-tech font-bold text-white skew-x-[12deg] text-lg">A</span>
            </div>
            <span className="font-tech font-bold text-lg tracking-wider text-white uppercase group-hover:text-cyan-400 transition-colors">Agro Arcade</span>
          </div>
          
          <button onClick={onBack} className="text-gray-400 hover:text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors border border-white/10 px-4 py-2 rounded hover:bg-white/5">
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
             Voltar ao Início
          </button>
      </nav>

      {/* --- 1. HERO SECTION --- */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 pt-20 border-b border-white/10">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.1)_0%,transparent_70%)]"></div>
        <div className="absolute inset-0 opacity-20 tactical-grid pointer-events-none"></div>
        
        <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8 animate-enter">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/30 bg-cyan-900/10 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-cyan-300 text-xs font-bold uppercase tracking-widest font-tech">Soluções Interativas White-Label</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black font-tech uppercase leading-tight tracking-tighter">
            Sua Marca, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">Seu Jogo.</span>
          </h1>
          
          <p className="text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
            O Agro é apenas um exemplo. Nossa tecnologia se adapta a <strong>qualquer setor</strong>. 
            Personalizamos cores, cenários e personagens para criar uma experiência única que reflete a identidade da sua empresa.
          </p>

          <div className="flex flex-col md:flex-row gap-4 justify-center mt-8">
            <button onClick={onContact} className="px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm md:text-base uppercase tracking-widest font-tech rounded-sm shadow-[0_0_20px_rgba(0,212,255,0.3)] transition-all hover:scale-105">
              Solicitar Orçamento
            </button>
            <button onClick={onBack} className="px-8 py-4 border border-white/20 hover:bg-white/5 text-gray-300 font-bold text-sm md:text-base uppercase tracking-widest font-tech rounded-sm transition-all">
              Testar Demo Agro
            </button>
          </div>
        </div>

        {/* Mockup Visual abstract - Showing Flexibility */}
        <div className="mt-16 w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6 opacity-90 perspective-1000">
           {/* Agro Version */}
           <div className="bg-[#111] border border-white/10 h-40 rounded-lg flex flex-col items-center justify-center relative overflow-hidden group hover:border-green-500/50 transition-colors">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-green-900/20"></div>
              <div className="text-3xl mb-2">🚜</div>
              <span className="font-tech text-green-400 text-sm tracking-widest">VERSÃO AGRO</span>
              <p className="text-[10px] text-gray-500 mt-2">Cenário: Lavoura</p>
           </div>
           
           {/* Your Brand Version */}
           <div className="bg-[#111] border-2 border-cyan-500 h-48 rounded-lg shadow-[0_0_30px_rgba(0,212,255,0.15)] flex flex-col items-center justify-center relative overflow-hidden transform md:-translate-y-4 z-20">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-cyan-900/20"></div>
              <div className="text-4xl mb-2">🚀</div>
              <span className="font-tech text-white text-lg font-bold tracking-widest">SUA MARCA</span>
              <p className="text-xs text-cyan-200 mt-2">Cenário: Sua Empresa</p>
              <div className="absolute bottom-0 w-full py-1 bg-cyan-900/50 text-center text-[10px] text-cyan-200 font-mono-hud">PERSONALIZAÇÃO TOTAL</div>
           </div>

           {/* Retail/Tech Version */}
           <div className="bg-[#111] border border-white/10 h-40 rounded-lg flex flex-col items-center justify-center relative overflow-hidden group hover:border-purple-500/50 transition-colors">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-purple-900/20"></div>
              <div className="text-3xl mb-2">🛒</div>
              <span className="font-tech text-purple-400 text-sm tracking-widest">VERSÃO VAREJO</span>
              <p className="text-[10px] text-gray-500 mt-2">Cenário: Loja</p>
           </div>
        </div>
      </section>

      {/* --- 2. FLEXIBILITY & BENEFITS --- */}
      <section className="py-20 px-6 bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-3xl font-tech font-bold uppercase mb-4 text-white">Mais que um jogo, <span className="text-cyan-400">uma ferramenta de marca.</span></h2>
            <p className="text-gray-400 max-w-2xl mx-auto font-light">
              Nossos jogos são "templates" prontos. Nós trocamos os elementos visuais para criar uma experiência que parece ter sido feita do zero para você.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#121212] p-8 rounded-lg border border-white/5 hover:border-cyan-500/30 transition-all duration-300">
              <div className="w-12 h-12 bg-cyan-900/20 rounded-full flex items-center justify-center mb-6 text-cyan-400 text-2xl">🎨</div>
              <h3 className="text-lg font-bold text-white mb-3 uppercase font-tech">Identidade Visual</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                As cores do jogo se adaptam à sua paleta. Se sua marca é azul, o jogo será azul. O logotipo no topo e na tela de "Game Over" será o seu.
              </p>
            </div>
            <div className="bg-[#121212] p-8 rounded-lg border border-white/5 hover:border-purple-500/30 transition-all duration-300">
              <div className="w-12 h-12 bg-purple-900/20 rounded-full flex items-center justify-center mb-6 text-purple-400 text-2xl">🔄</div>
              <h3 className="text-lg font-bold text-white mb-3 uppercase font-tech">Troca de Sprites</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                No lugar de um trator, podemos colocar um carro, um carrinho de compras ou seu mascote. No lugar de "pragas", colocamos os desafios do seu setor.
              </p>
            </div>
            <div className="bg-[#121212] p-8 rounded-lg border border-white/5 hover:border-green-500/30 transition-all duration-300">
              <div className="w-12 h-12 bg-green-900/20 rounded-full flex items-center justify-center mb-6 text-green-400 text-2xl">📊</div>
              <h3 className="text-lg font-bold text-white mb-3 uppercase font-tech">Dados & Leads</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Além da diversão, o foco é resultado. Capture e-mails e telefones através do ranking e receba relatórios de engajamento do seu público.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- 3. USE CASES (Generic) --- */}
      <section className="py-20 px-6 border-y border-white/5 relative bg-[#080808]">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
             
             {/* Text Side */}
             <div className="space-y-8">
                <div>
                   <h2 className="text-3xl font-tech font-bold uppercase mb-4">Onde usar?</h2>
                   <div className="h-1 w-20 bg-gradient-to-r from-cyan-500 to-blue-600"></div>
                </div>

                <div className="space-y-6">
                   <div className="flex gap-4">
                      <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center text-xl shrink-0">🏛️</div>
                      <div>
                         <h4 className="font-bold text-white uppercase text-sm mb-1">Feiras e Estandes</h4>
                         <p className="text-gray-400 text-xs leading-relaxed">
                            Substitua o formulário de papel por um QR Code gigante. O visitante joga, se diverte e deixa o contato para ver sua pontuação no telão.
                         </p>
                      </div>
                   </div>

                   <div className="flex gap-4">
                      <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center text-xl shrink-0">👥</div>
                      <div>
                         <h4 className="font-bold text-white uppercase text-sm mb-1">Endomarketing & RH</h4>
                         <p className="text-gray-400 text-xs leading-relaxed">
                            Transforme a SIPAT ou treinamentos internos. Crie uma competição saudável entre colaboradores com prêmios para os melhores colocados.
                         </p>
                      </div>
                   </div>

                   <div className="flex gap-4">
                      <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center text-xl shrink-0">🛍️</div>
                      <div>
                         <h4 className="font-bold text-white uppercase text-sm mb-1">Varejo e Lançamentos</h4>
                         <p className="text-gray-400 text-xs leading-relaxed">
                            Vai lançar um produto? Faça o cliente interagir com ele no jogo. Aumente o tempo de permanência da marca na mente do consumidor.
                         </p>
                      </div>
                   </div>
                </div>
             </div>

             {/* Visual Side - Abstract Representation of Adaptation */}
             <div className="relative h-80 bg-[#111] rounded-xl border border-white/10 p-6 flex flex-col justify-between overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[80px]"></div>
                
                <div className="relative z-10 text-center">
                   <p className="font-mono-hud text-cyan-500 text-xs mb-2">SISTEMA MODULAR</p>
                   <h3 className="font-tech text-2xl text-white">Configuração Rápida</h3>
                </div>

                <div className="grid grid-cols-3 gap-2 relative z-10 mt-4">
                   <div className="bg-white/5 p-2 rounded text-center">
                      <div className="text-xs text-gray-500 mb-1">TEMÁTICA</div>
                      <div className="text-white font-bold text-sm">LIVRE</div>
                   </div>
                   <div className="bg-white/5 p-2 rounded text-center">
                      <div className="text-xs text-gray-500 mb-1">PLATAFORMA</div>
                      <div className="text-white font-bold text-sm">WEB/MOBILE</div>
                   </div>
                   <div className="bg-white/5 p-2 rounded text-center">
                      <div className="text-xs text-gray-500 mb-1">ENTREGA</div>
                      <div className="text-white font-bold text-sm">RÁPIDA</div>
                   </div>
                </div>

                <div className="mt-6 border-t border-white/10 pt-4 text-center">
                   <p className="text-xs text-gray-400 italic">
                      "A tecnologia é a mesma, a experiência é toda sua."
                   </p>
                </div>
             </div>

          </div>
        </div>
      </section>

      {/* --- 4. CTA FOOTER --- */}
      <section className="py-24 px-6 bg-gradient-to-t from-[#0a1a1a] to-[#050505] border-t border-white/5 text-center">
         <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-3xl md:text-4xl font-black font-tech uppercase text-white">Vamos criar algo juntos?</h2>
            <p className="text-lg text-gray-400 font-light">
               Conte sua ideia e nós mostramos como ela pode virar um jogo.
            </p>
            <div className="flex flex-col md:flex-row gap-4 justify-center pt-4">
               <button onClick={onContact} className="px-10 py-4 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold text-sm uppercase tracking-widest font-tech rounded flex items-center justify-center gap-3 shadow-lg transition-transform hover:-translate-y-1">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.017-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                  Falar no WhatsApp
               </button>
               <button onClick={onBack} className="px-10 py-4 bg-white hover:bg-gray-200 text-black font-bold text-sm uppercase tracking-widest font-tech rounded">
                  Ver Exemplos Agro
               </button>
            </div>
         </div>
      </section>
    </div>
  );
};

export default BusinessPage;