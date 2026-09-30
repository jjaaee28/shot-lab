'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isLogin, setIsLogin] = useState(true);
  
  const router = useRouter();
  const supabase = createClient();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      let result;
      if (isLogin) {
        result = await supabase.auth.signInWithPassword({ email, password });
      } else {
        result = await supabase.auth.signUp({ email, password });
      }

      if (result.error) {
        setError(result.error.message);
      } else {
        // 성공 시 메인으로 이동
        router.push('/');
        router.refresh(); // 세션 상태 반영 위해 리프레시
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <header className="masthead">
        <a className="brand" href="/" aria-label="촬영 구도 실험실 처음으로">
          <span className="brand-icon" aria-hidden="true">◧</span>
          <span>SHOT LAB<span className="brand-ko">촬영 구도 실험실</span></span>
        </a>
        <span className="edition">CAMERA STUDY <span>/</span> 001</span>
      </header>
      
      <section className="intro" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '400px', padding: '32px', border: '1px solid var(--ink)', background: 'var(--paper)' }}>
          <h2 style={{ fontSize: '24px', letterSpacing: '-1px', marginBottom: '24px', textAlign: 'center' }}>
            {isLogin ? '로그인' : '회원가입'}
          </h2>
          
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: '12px', marginBottom: '8px' }}>이메일</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '12px', border: '1px solid var(--ink)', background: 'transparent', color: 'var(--ink)' }}
              />
            </div>
            
            <div>
              <label htmlFor="password" style={{ display: 'block', fontSize: '12px', marginBottom: '8px' }}>비밀번호</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '12px', border: '1px solid var(--ink)', background: 'transparent', color: 'var(--ink)' }}
              />
            </div>
            
            {error && <div style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>{error}</div>}
            
            <button type="submit" className="primary" disabled={loading} style={{ marginTop: '16px' }}>
              <span>{loading ? '처리 중...' : (isLogin ? '로그인' : '가입하기')}</span>
            </button>
          </form>
          
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <button 
              type="button" 
              className="text-button" 
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
            </button>
          </div>
        </div>
      </section>
      
      <footer>
        <span>가상 장면 · 구도 이해를 위한 시연용 애니메이션</span>
        <span>SHOT LAB / 첫 번째 장면</span>
      </footer>
    </main>
  );
}
