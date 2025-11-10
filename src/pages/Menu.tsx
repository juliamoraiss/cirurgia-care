import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Menu = () => {
  const menuItems = [
    { name: 'Brigadeiro', price: 'R$2,00' },
    { name: 'Beijinho', price: 'R$2,00' },
    { name: 'Leite em pó', price: 'R$2,00' },
    { name: 'Amendoim', price: 'R$2,00' },
    { name: 'Avelã', price: 'R$2,00' },
    { name: 'Morango', price: 'R$2,00' },
    { name: 'Doce de leite', price: 'R$2,00' },
  ];

  const handleWhatsAppClick = () => {
    window.open('https://wa.me/5512345678990', '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-pink-600 to-pink-700 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center">
        {/* Lado esquerdo - Conteúdo */}
        <div className="space-y-8 text-center md:text-left">
          {/* Título principal */}
          <div className="space-y-2">
            <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight">
              Uma
              <br />
              explosão
              <br />
              de sabor!
            </h1>
          </div>

          {/* Card de sabores */}
          <div className="bg-amber-50 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-3xl md:text-4xl font-bold text-pink-600 mb-6">
              Sabores:
            </h2>
            <div className="space-y-3">
              {menuItems.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center text-lg md:text-xl"
                >
                  <span className="text-amber-800 font-medium">{item.name}</span>
                  <span className="text-amber-700 font-semibold">{item.price}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Botão WhatsApp */}
          <Button
            onClick={handleWhatsAppClick}
            size="lg"
            className="w-full md:w-auto bg-amber-700 hover:bg-amber-800 text-white text-xl px-8 py-6 rounded-full shadow-lg transition-all hover:scale-105"
          >
            <Phone className="mr-2 h-6 w-6" />
            (12) 3456-7890
          </Button>
        </div>

        {/* Lado direito - Imagens decorativas */}
        <div className="hidden md:flex flex-col gap-6 justify-center items-center">
          <div className="w-64 h-64 bg-white/10 rounded-full backdrop-blur-sm flex items-center justify-center">
            <div className="text-white text-center">
              <div className="text-6xl mb-2">🧁</div>
              <p className="text-sm font-medium">Brigadeiros Gourmet</p>
            </div>
          </div>
          <div className="w-48 h-48 bg-white/10 rounded-full backdrop-blur-sm flex items-center justify-center">
            <div className="text-white text-center">
              <div className="text-5xl mb-2">🍫</div>
              <p className="text-xs font-medium">Feito com amor</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Menu;
