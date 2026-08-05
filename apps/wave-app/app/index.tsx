import LoginScreen from "./login";

/**
 * Tela inicial (pública) = **login**. A antiga tela de escolha (login/cadastro)
 * foi removida a pedido do teste em grupo: a porta de entrada é o login, e o
 * cadastro fica a um toque no próprio login ("Não tem conta? Criar conta").
 *
 * Quem já tem sessão é levado pela guarda de rota (`_layout.tsx`) direto para a
 * área do seu papel, sem passar por aqui.
 */
export default function HomeScreen() {
  return <LoginScreen />;
}
