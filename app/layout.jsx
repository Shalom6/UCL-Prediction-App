import './globals.css';

export const metadata = {
  title: 'UCL Final Predictor',
  description: 'Next.js + Express UCL final predictor'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="bg">
          <div className="bgGlow a" />
          <div className="bgGlow b" />
          <div className="container">{children}</div>
        </div>
      </body>
    </html>
  );
}

