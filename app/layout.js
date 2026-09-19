import './globals.css';
export const metadata = {
  title: '촬영 구도 실험실 · SHOT LAB',
  description: '같은 장면, 다른 카메라. 책 읽는 인물을 통해 촬영 구도를 실험해 보세요.',
  icons: { icon: '/icon.svg' },
};
export default function Layout({ children }) {
  return <html lang="ko"><body>{children}</body></html>;
}
