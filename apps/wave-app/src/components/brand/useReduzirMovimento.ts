import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Segue a preferência de **reduzir movimento** do sistema.
 *
 * Toda animação da identidade é ornamento, então respeitar isto não custa
 * informação nenhuma: quem pediu menos movimento vê a mesma figura, parada.
 *
 * No web o `AccessibilityInfo` do react-native-web lê
 * `prefers-reduced-motion`; no mobile, a preferência do sistema. A escuta
 * existe porque a pessoa pode mudar isso com o app aberto.
 */
export function useReduzirMovimento(): boolean {
  const [reduzir, setReduzir] = useState(false);

  useEffect(() => {
    let ativo = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (ativo) setReduzir(v);
    });
    const inscricao = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduzir);
    return () => {
      ativo = false;
      inscricao.remove();
    };
  }, []);

  return reduzir;
}
