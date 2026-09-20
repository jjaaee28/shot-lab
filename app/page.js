'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildScene, cameraPose, METHODS, PRESETS } from './scene';

const INITIAL={method:'fixed',angle:0,elevation:0,zoom:1.0,panX:0,panY:0,guide:false,progress:0,playing:false,preset:'front',adjusted:false};
export default function Home(){
  const [entered,setEntered]=useState(false);
  const [view,setView]=useState({...INITIAL});
  const state=useRef({...INITIAL});
  const mount=useRef(null);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const drag=useRef(null);
  const pointers=useRef(new Map());
  const pinchDist=useRef(0);
  const lastUpdate=useRef(0);
  function commit(update){Object.assign(state.current,update);setView({...state.current});}
  function chooseMethod(id){commit({method:id,progress:0,playing:id!=='fixed',adjusted:false});}
  function choosePreset(p){commit({preset:p.id,angle:p.angle,elevation:p.elevation,progress:0,playing:state.current.method!=='fixed',adjusted:false});}
  function adjustZoom(delta){
    const s=state.current;
    const nextZoom=Math.round(Math.max(0.5,Math.min(3.0,(s.zoom||1.0)+delta))*10)/10;
    commit({zoom:nextZoom});
  }
  function setZoomDirect(value){
    const nextZoom=Math.round(Math.max(0.5,Math.min(3.0,value))*10)/10;
    commit({zoom:nextZoom});
  }
  function turn(deltaAngle, deltaElevation = 0){
    const s=state.current;
    const pose=cameraPose(s.method,s.progress,s.angle,s.elevation);
    const angle=pose.angle+deltaAngle;
    const minElev=-0.16, maxElev=0.95;
    const nextElev=Math.max(minElev,Math.min(maxElev,s.elevation+deltaElevation));
    const isOrbit=s.method==='orbit_right'||s.method==='orbit_left'||s.method==='orbit';
    const orbitDir=s.method==='orbit_left'?-1:1;
    commit({angle:angle-(isOrbit?orbitDir*s.progress*Math.PI*2:0),elevation:nextElev,playing:false,preset:'custom',adjusted:s.method!=='fixed'});
  }
  function restart(){const s=state.current;commit({angle:s.adjusted?cameraPose(s.method,s.progress,s.angle,s.elevation).angle:s.angle,progress:0,playing:true,adjusted:false});}
  useEffect(()=>{
    const context=document.modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    Promise.resolve(context.registerTool({name:'configure_shot',description:'Open the camera experiment and select a filming method and a preset viewpoint.',inputSchema:{type:'object',properties:{method:{type:'string',enum:METHODS.map(m=>m.id)},preset:{type:'string',enum:PRESETS.map(p=>p.id)}},required:['method','preset'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async(input)=>{
      const p=PRESETS.find(p=>p.id===input.preset);const m=METHODS.find(m=>m.id===input.method);
      if(!p||!m)throw new Error('Unknown method or preset');
      setEntered(true);commit({method:m.id,preset:p.id,angle:p.angle,elevation:p.elevation,progress:0,playing:m.id!=='fixed',adjusted:false});
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      return {method:state.current.method,preset:state.current.preset};
    }},{signal:lifecycle.signal})).catch(()=>{});
    return()=>lifecycle.abort();
  },[]);
  useEffect(()=>{
    const host=mount.current;if(!host)return;
    setReady(false);setError('');
    let renderer,frame,observer,disposeScene;
    let alive=true,lastTime=0;
    const onLost=e=>{e.preventDefault();setError('그래픽 연결이 끊겼어요. 장면을 다시 불러와 주세요.');setReady(false);};
    try{
      const scene=new THREE.Scene();scene.background=new THREE.Color(0xf2e9da);
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
      renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.domElement.setAttribute('aria-label','의자에 앉아 책을 읽는 인물의 3D 촬영 장면');
      renderer.domElement.setAttribute('role','img');
      host.appendChild(renderer.domElement);
      renderer.domElement.addEventListener('webglcontextlost',onLost);
      disposeScene=buildScene(scene);
      const camera=new THREE.PerspectiveCamera(40,1,.05,50);
      const resize=()=>{const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.zoom=state.current.zoom||1.0;camera.updateProjectionMatrix();};
      observer=new ResizeObserver(resize);observer.observe(host);resize();
      function animate(time){
        if(!alive)return;
        const s=state.current;const dt=lastTime?Math.min((time-lastTime)/1000,.05):0;lastTime=time;
        const method=METHODS.find(m=>m.id===s.method);
        if(s.playing&&method?.duration){s.progress=Math.min(1,s.progress+dt/method.duration);if(s.progress>=1)s.playing=false;}
        const pose=cameraPose(s.method,s.progress,s.angle,s.elevation);
        const basePos=new THREE.Vector3(...pose.position);
        const baseTarget=new THREE.Vector3(0,1.12,0);
        const forward=new THREE.Vector3().subVectors(baseTarget,basePos).normalize();
        const up=new THREE.Vector3(0,1,0);
        const right=new THREE.Vector3().crossVectors(forward,up).normalize();
        const screenUp=new THREE.Vector3().crossVectors(right,forward).normalize();
        const panOffset=right.multiplyScalar(s.panX||0).add(screenUp.multiplyScalar(s.panY||0));
        camera.position.copy(basePos.clone().add(panOffset));
        camera.lookAt(baseTarget.clone().add(panOffset));
        const targetZoom=s.zoom||1.0;
        if(Math.abs(camera.zoom-targetZoom)>0.001){camera.zoom=targetZoom;camera.updateProjectionMatrix();}
        renderer.render(scene,camera);
        if(time-lastUpdate.current>80){lastUpdate.current=time;setView({...s});}
        frame=requestAnimationFrame(animate);
      }
      frame=requestAnimationFrame(animate);setReady(true);
    }catch(e){setError('3D 장면을 표시하지 못했어요. 브라우저의 그래픽 가속을 확인하거나 다시 불러와 주세요.');}
    return()=>{alive=false;cancelAnimationFrame(frame);observer?.disconnect();disposeScene?.();if(renderer){renderer.domElement.removeEventListener('webglcontextlost',onLost);renderer.dispose();renderer.domElement.remove();}};
  },[retry]);
  useEffect(()=>{
    const host=mount.current;if(!host)return;
    const onWheel=(e)=>{
      if(!entered)return;
      e.preventDefault();
      const delta=e.deltaY<0?0.1:-0.1;
      adjustZoom(delta);
    };
    host.addEventListener('wheel',onWheel,{passive:false});
    return()=>host.removeEventListener('wheel',onWheel);
  },[entered]);
  function pointerDown(e){
    if(!entered||!ready||error)return;
    const isPan=e.button===2||e.shiftKey;
    pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.current.size===2){
      const pts=Array.from(pointers.current.values());
      pinchDist.current=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
    }
    drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,type:isPan?'pan':'turn',active:false};
  }
  function pointerMove(e){
    if(pointers.current.has(e.pointerId)){
      pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    }
    if(pointers.current.size>=2){
      const pts=Array.from(pointers.current.values());
      const dist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
      if(pinchDist.current>0){
        const diff=dist-pinchDist.current;
        if(Math.abs(diff)>2){
          adjustZoom(diff*0.005);
          pinchDist.current=dist;
        }
      }else{
        pinchDist.current=dist;
      }
      return;
    }
    const d=drag.current;if(!d||d.id!==e.pointerId)return;
    const dx=e.clientX-d.x,dy=e.clientY-d.y;
    if(!d.active){
      if(Math.hypot(dx,dy)<3)return;
      d.active=true;
      try{e.currentTarget.setPointerCapture(e.pointerId);}catch(_){}
    }
    if(d.type==='pan'){
      const nextPanX=Math.max(-1.6,Math.min(1.6,(state.current.panX||0)-dx*0.005));
      const nextPanY=Math.max(-1.2,Math.min(1.2,(state.current.panY||0)+dy*0.005));
      commit({panX:Math.round(nextPanX*100)/100,panY:Math.round(nextPanY*100)/100});
    }else{
      turn(-dx*.008,-dy*.006);
    }
    d.x=e.clientX;d.y=e.clientY;
  }
  function pointerUp(e){
    pointers.current.delete(e.pointerId);
    if(pointers.current.size<2)pinchDist.current=0;
    if(drag.current?.id===e.pointerId){
      if(drag.current.active){try{e.currentTarget.releasePointerCapture(e.pointerId);}catch(_){}}
      drag.current=null;
    }
  }
  const method=METHODS.find(m=>m.id===view.method);
  const pose=cameraPose(view.method,view.progress,view.angle,view.elevation);
  const degrees=((pose.angle*180/Math.PI)%360+360)%360;
  const livePitchDeg=Math.round((pose.elevation??view.elevation)*180/Math.PI);
  const horizontalFraming=Math.abs(view.panX||0)<0.2?'중앙':(view.panX||0)>0?'좌측 1/3':'우측 1/3';
  const verticalFraming=Math.abs(view.panY||0)<0.15?'중앙':(view.panY||0)<0?'상단 1/3':'하단 1/3';
  const framingLabel=`${horizontalFraming} · ${verticalFraming}`;
  const preset=PRESETS.find(p=>p.id===view.preset);
  const status=view.method==='fixed'?'고정 구도':view.adjusted?'방향 설정됨':view.playing?'재생 중':view.progress>=1?'재생 완료':'일시정지';
  return <main>
    <header className="masthead"><a className="brand" href="/" aria-label="촬영 구도 실험실 처음으로"><span className="brand-icon" aria-hidden="true">◧</span><span>SHOT LAB<span className="brand-ko">촬영 구도 실험실</span></span></a><span className="edition">CAMERA STUDY <span>/</span> 001</span></header>
    <section className={entered?'workspace':'intro'}>
      <div className="heading"><div><p className="eyebrow">{entered?'THE CAMERA IS YOURS':'A SMALL STUDY OF PERSPECTIVE'}</p><h1>{entered?'카메라를 움직여 보세요.':<>같은 장면,<br/>다른 카메라.</>}</h1></div>{entered?<button className="text-button" onClick={()=>{setEntered(false);commit({...INITIAL});}}>소개로 돌아가기 ↗</button>:<p className="intro-copy">촬영을 처음 배우는 사람을 위한 작은 실험실.<br/>각도와 움직임만 바꿔도, 장면은 달라집니다.</p>}</div>
      <div className="lab-grid">
        <section className="viewer" aria-label="촬영 장면">
          <div className="viewer-bar"><span>SCENE 01 <span className="bar-divider">/</span> 책 읽는 오후</span><span>{entered?status:'PREVIEW'}</span></div>
          <div className="stage" ref={mount} tabIndex={entered?0:-1} role="group" aria-label="장면 조작. 좌클릭 회전, 우클릭 상하좌우 프레이밍 이동, 휠 줌" onContextMenu={e=>e.preventDefault()} onKeyDown={e=>{if(entered&&ready&&!error){if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();turn(e.key==='ArrowLeft'?-.1:.1,0);}else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();turn(0,e.key==='ArrowUp'?.05:-.05);}}}} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
            <span className="frame-corner tl"/><span className="frame-corner tr"/><span className="frame-corner bl"/><span className="frame-corner br"/>
            {view.guide&&(
              <div className="stage-grid-guide" aria-hidden="true">
                <span className="grid-line-v v1"/><span className="grid-line-v v2"/><span className="grid-line-h h1"/><span className="grid-line-h h2"/>
              </div>
            )}
            {entered&&ready&&!error&&(
              <div className="stage-overlay-bar">
                <button type="button" className={`stage-guide-btn ${view.guide?'active':''}`} onClick={()=>commit({guide:!view.guide})} title="3분할 격자 가이드 토글"># 3분할 선</button>
                <div className="stage-zoom-controls" role="group" aria-label="화면 줌 조절">
                  <button type="button" onClick={()=>adjustZoom(-0.2)} disabled={(view.zoom||1.0)<=0.5} title="줌 아웃 (−)">−</button>
                  <span className="stage-zoom-value mono">{(view.zoom||1.0).toFixed(1)}x</span>
                  <button type="button" onClick={()=>adjustZoom(0.2)} disabled={(view.zoom||1.0)>=3.0} title="줌 인 (+)">+</button>
                  {(view.zoom||1.0)!==1.0&&<button type="button" onClick={()=>setZoomDirect(1.0)} title="1.0x 초기화" className="stage-zoom-reset">↺</button>}
                </div>
              </div>
            )}
            {(!ready||error)&&<div className="stage-notice" role={error?'alert':'status'}><p>{error||'장면을 준비하고 있어요.'}</p>{error&&<button onClick={()=>setRetry(r=>r+1)}>다시 불러오기</button>}</div>}
          </div>
          <div className="viewer-caption"><span>{entered?'↔ ↕ 회전 · 우클릭 상하좌우 이동 · 휠 줌':'의자에 앉아 책을 읽는 인물'}</span><span className="mono">{entered?`${Math.round(degrees)}° / ${livePitchDeg>=0?'+':''}${livePitchDeg}° · ${framingLabel} · ${(view.zoom||1.0).toFixed(1)}x`:'16 : 9'}</span></div>
          {entered&&<div className="transport"><div className="transport-top"><span className="status" role="status">{status}</span><span className="mono">{method.duration?`${(view.progress*method.duration).toFixed(1)} / ${method.duration.toFixed(1)} s`:'— / —'}</span></div><div className="progress" role="progressbar" aria-label="촬영 재생 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(view.progress*100)}><span style={{width:`${view.progress*100}%`}}/></div>{method.duration>0?<div className="play-controls"><button disabled={!ready||!!error} onClick={()=>view.progress>=1||view.adjusted?restart():commit({playing:!view.playing})}>{view.playing?'Ⅱ 일시정지':view.adjusted?'▷ 이 방향에서 재생':view.progress>=1?'▷ 다시 재생':'▷ 계속 재생'}</button><button disabled={!ready||!!error} className="text-button" onClick={restart}>↺ 처음부터</button></div>:<p className="fixed-note">카메라는 멈춰 있어요. 다른 각도를 선택하거나 장면을 돌려보세요.</p>}</div>}
        </section>
        {entered?<aside className="controls">
          <div className="control-heading"><span className="section-number">01</span><h2>촬영 방법</h2><span className="control-count">{METHODS.length} METHODS</span></div>
          <div className="methods">{METHODS.map((m,i)=><div className="method-item" key={m.id}>
            <button disabled={!ready||!!error} aria-pressed={view.method===m.id} className={`method ${view.method===m.id?'selected':''}`} onClick={()=>chooseMethod(m.id)}><span className="method-glyph" aria-hidden="true">{m.glyph}</span><span><strong>{m.name}</strong><small>{m.english}</small></span><span className="method-end">{view.method===m.id?'✓':(i+1).toString().padStart(2,'0')}</span></button>
            {view.method===m.id&&<div className="method-description-box" aria-live="polite"><p className="method-description">{m.description}</p></div>}
          </div>)}</div>
          <div className="control-heading preset-heading"><span className="section-number">02</span><h2>시작 각도</h2></div>
          <div className="presets">{PRESETS.map(p=><button disabled={!ready||!!error} key={p.id} aria-pressed={view.preset===p.id} className={view.preset===p.id?'selected':''} onClick={()=>choosePreset(p)}>{p.name}</button>)}</div>
          <p className="view-note">{preset?preset.name:'직접 설정한 방향'} · 360° 및 상하 각도 조절 가능</p>
          <div className="control-heading preset-heading"><span className="section-number">03</span><h2>인물 프레이밍</h2><span className="control-count">{framingLabel}</span></div>
          <p className="framing-axis">가로 위치</p>
          <div className="framing-presets">
            <button type="button" className={(view.panX||0)>0.5?'selected':''} onClick={()=>commit({panX:1.1})}>좌측 1/3</button>
            <button type="button" className={Math.abs(view.panX||0)<=0.5?'selected':''} onClick={()=>commit({panX:0})}>중앙 배치</button>
            <button type="button" className={(view.panX||0)<-0.5?'selected':''} onClick={()=>commit({panX:-1.1})}>우측 1/3</button>
          </div>
          <div className="framing-slider-box">
            <span className="framing-side-label">좌측</span>
            <input type="range" min="-1.6" max="1.6" step="0.1" value={view.panX||0} onChange={e=>commit({panX:parseFloat(e.target.value)})} aria-label="인물 화면 위치 슬라이더" />
            <span className="framing-side-label">우측</span>
          </div>
          <p className="framing-axis">세로 위치</p>
          <div className="framing-presets">
            <button type="button" className={(view.panY||0)<-0.35?'selected':''} onClick={()=>commit({panY:-0.75})}>상단 1/3</button>
            <button type="button" className={Math.abs(view.panY||0)<=0.35?'selected':''} onClick={()=>commit({panY:0})}>중앙 배치</button>
            <button type="button" className={(view.panY||0)>0.35?'selected':''} onClick={()=>commit({panY:0.75})}>하단 1/3</button>
          </div>
          <div className="framing-slider-box">
            <span className="framing-side-label">상단</span>
            <input type="range" min="-1.2" max="1.2" step="0.1" value={view.panY||0} onChange={e=>commit({panY:parseFloat(e.target.value)})} aria-label="인물 세로 위치 슬라이더" />
            <span className="framing-side-label">하단</span>
            <button type="button" className="zoom-reset" disabled={!view.panX&&!view.panY} onClick={()=>commit({panX:0,panY:0})} title="프레이밍 중앙 초기화">중앙</button>
          </div>
          <p className="view-note">우클릭 드래그 또는 슬라이더로 카메라를 상하좌우 이동해 인물을 원하는 위치에 배치합니다.</p>
          <div className="control-heading preset-heading"><span className="section-number">04</span><h2>카메라 줌</h2><span className="control-count mono">{(view.zoom||1.0).toFixed(1)}x</span></div>
          <div className="zoom-control-box">
            <div className="zoom-bar">
              <button type="button" disabled={!ready||!!error||(view.zoom||1.0)<=0.5} onClick={()=>adjustZoom(-0.2)} aria-label="줌 아웃">−</button>
              <input type="range" min="0.5" max="3.0" step="0.1" value={view.zoom||1.0} onChange={e=>setZoomDirect(parseFloat(e.target.value))} aria-label="줌 크기 슬라이더" />
              <button type="button" disabled={!ready||!!error||(view.zoom||1.0)>=3.0} onClick={()=>adjustZoom(0.2)} aria-label="줌 인">+</button>
              <button type="button" className="zoom-reset" disabled={!ready||!!error||(view.zoom||1.0)===1.0} onClick={()=>setZoomDirect(1.0)}>1.0x</button>
            </div>
            <div className="zoom-presets">
              {[0.7, 1.0, 1.5, 2.2].map(z=>(
                <button key={z} type="button" className={(view.zoom||1.0)===z?'selected':''} onClick={()=>setZoomDirect(z)}>{z===0.7?'0.7x (광각)':z===1.0?'1.0x (표준)':z===1.5?'1.5x (클로즈업)':'2.2x (익스트림)'}</button>
              ))}
            </div>
          </div>
          <p className="view-note">0.5x(광각) ↔ 3.0x(망원) · 휠 스크롤 또는 슬라이더로 조절</p>
          <div className="scene-note"><span className="eyebrow">ONE SCENE, MANY WAYS TO SEE</span><p>인물과 공간은 그대로.<br/>바뀌는 건 카메라뿐입니다.</p></div>
        </aside>:<aside className="intro-panel"><span className="section-number">01 / CAMERA EXPERIMENT</span><h2>어디서,<br/>어떻게 바라볼까요?</h2><p>책을 읽는 인물과 작은 공간.<br/>카메라를 가까이, 멀리, 주변으로<br className="desktop-break"/> 움직이며 구도를 확인해 보세요.</p><div className="intro-tags"><span>고정 각도 4개</span><span>이동 촬영 9종</span><span>사이드 프레이밍</span><span>자유 시점 및 줌</span></div><button className="primary" disabled={!ready||!!error} onClick={()=>setEntered(true)}>촬영 방법 둘러보기 <span>↗</span></button><p className="intro-hint">직접 누르고, 돌려보며 이해하는 촬영</p></aside>}
      </div>
    </section>
    <footer><span>가상 장면 · 구도 이해를 위한 시연용 애니메이션</span><span>SHOT LAB / 첫 번째 장면</span></footer>
  </main>;
}


