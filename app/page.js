'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildScene, cameraPose, METHODS, PRESETS } from './scene';

const INITIAL={method:'fixed',angle:0,elevation:0,zoom:1.0,panX:0,panY:0,guide:false,progress:0,playing:false,preset:'front',adjusted:false};
const DEMO_DATE='2026. 09. 20.';
export default function Home(){
  const [loginPage,setLoginPage]=useState(true);
  const [entered,setEntered]=useState(false);
  const [scriptPage,setScriptPage]=useState(false);
  const [libraryPage,setLibraryPage]=useState(false);
  const [editingShotId,setEditingShotId]=useState(null);
  const [editingShotTitle,setEditingShotTitle]=useState('');
  const [saveFeedback,setSaveFeedback]=useState('');
  const [showControlsHint,setShowControlsHint]=useState(true);
  const [savedShots,setSavedShots]=useState([
    {id:'sample-static',title:'창가의 정면',method:'fixed',date:DEMO_DATE,angle:0,elevation:0,zoom:1,panX:0,panY:0,preset:'front'},
    {id:'sample-arc',title:'인물을 도는 시선',method:'orbit_right',date:DEMO_DATE,angle:Math.PI/2,elevation:0,zoom:1.2,panX:0,panY:0,preset:'side'},
    {id:'sample-dolly',title:'책장으로 다가가기',method:'in',date:DEMO_DATE,angle:0,elevation:0,zoom:1.5,panX:0.5,panY:0,preset:'front'},
    {id:'sample-tilt',title:'시선을 올려 보는 순간',method:'tilt_up',date:DEMO_DATE,angle:Math.PI/2,elevation:0.2,zoom:1,panX:0,panY:-0.4,preset:'side'},
    {id:'sample-low',title:'낮은 시선의 독서',method:'fixed',date:DEMO_DATE,angle:0,elevation:-0.12,zoom:1.2,panX:-0.5,panY:0.5,preset:'low'}
  ]);
  const [scriptText,setScriptText]=useState('INT. 작은 방 - 오후\n\n창가에 앉은 인물이 책장을 넘긴다.\n카메라는 인물의 옆을 천천히 지나간다.');
  const [demoLoading,setDemoLoading]=useState(false);
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
  function openScript(){setLibraryPage(false);setEntered(false);setScriptPage(true);}
  function openIntro(){setLibraryPage(false);setEntered(false);setScriptPage(false);commit({...INITIAL});}
  function demoLogin(e){e.preventDefault();setLoginPage(false);setEntered(false);setScriptPage(false);commit({...INITIAL});}
  function drawDemo(){setDemoLoading(true);window.setTimeout(()=>{setDemoLoading(false);setScriptPage(false);setEntered(true);commit({...INITIAL,method:'fixed',playing:false});},700);}
  function openLibrary(){setLoginPage(false);setScriptPage(false);setEntered(true);setLibraryPage(true);}
  function closeLibrary(){setLibraryPage(false);setEntered(true);}
  function saveCurrentShot(){const s=state.current;const m=METHODS.find(item=>item.id===s.method);setSavedShots(prev=>{const count=prev.length+1;setSaveFeedback(`저장됨 · ${count}개`);window.setTimeout(()=>setSaveFeedback(''),2200);return [{id:`shot-${Date.now()}`,title:`${m?.name||'저장한 구도'} · ${count}`,method:s.method,date:DEMO_DATE,angle:s.angle,elevation:s.elevation,zoom:s.zoom,panX:s.panX,panY:s.panY,preset:s.preset},...prev];});}
  function loadShot(shot){setLibraryPage(false);setEntered(true);commit({method:shot.method,angle:shot.angle,elevation:shot.elevation,zoom:shot.zoom,panX:shot.panX,panY:shot.panY,preset:shot.preset,progress:0,playing:false,adjusted:false});}
  function startRename(shot){setEditingShotId(shot.id);setEditingShotTitle(shot.title);}
  function finishRename(){const title=editingShotTitle.trim();if(title)setSavedShots(prev=>prev.map(shot=>shot.id===editingShotId?{...shot,title}:shot));setEditingShotId(null);setEditingShotTitle('');}
  function removeShot(id){setSavedShots(prev=>prev.filter(shot=>shot.id!==id));if(editingShotId===id){setEditingShotId(null);setEditingShotTitle('');}}
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
  const pageNumber=loginPage?'001':scriptPage?'003':libraryPage?'005':entered?'004':'002';
  return <main>
    <style jsx global>{` .script-panel{padding:16px 0}.script-panel-label{display:flex;justify-content:space-between;align-items:center;gap:12px}.demo-badge{font:11px 'Courier New',monospace;border:1px solid var(--ink);padding:4px 7px}.script-panel h2{font-size:28px;line-height:1.45;letter-spacing:-1px;font-weight:500;margin:25px 0 16px}.script-help{font-size:14px;line-height:1.8;margin-bottom:24px}.script-label{display:block;font:12px 'Courier New',monospace;letter-spacing:1px;margin-bottom:8px}.script-panel textarea{display:block;width:100%;min-height:190px;resize:vertical;background:transparent;color:var(--ink);border:1px solid var(--ink);padding:14px;font:14px/1.8 'Courier New','Malgun Gothic',monospace;outline:none}.script-panel textarea:focus{box-shadow:inset 0 0 0 2px var(--ink)}.script-meta{display:flex;justify-content:space-between;font:11px 'Courier New',monospace;margin:8px 0 18px}.script-back{width:100%;margin-top:8px;text-align:center}.intro-direct{width:100%;margin-top:10px;text-align:center}.intro-library{border:1px solid var(--ink);padding:10px 14px;transition:transform 120ms ease,box-shadow 120ms ease}.intro-library:hover{background:var(--ink);color:var(--paper)}.intro-library:active{transform:translateY(2px);box-shadow:inset 0 2px 0 var(--ink)}.workspace .viewer{position:sticky;top:24px;align-self:start}.login-panel{max-width:440px;padding:12px 0 30px}.login-panel h2{font-size:30px;line-height:1.4;letter-spacing:-1px;font-weight:500;margin:22px 0 14px}.login-help{font-size:14px;line-height:1.8;margin-bottom:26px}.login-form{display:grid;gap:10px}.login-label{font:12px 'Courier New',monospace;letter-spacing:1px;margin-top:6px}.login-input{width:100%;height:50px;background:transparent;border:1px solid var(--ink);padding:0 14px;color:var(--ink);font:16px 'Malgun Gothic',sans-serif;outline:none}.login-input:focus{box-shadow:inset 0 0 0 2px var(--ink)}.login-demo-note{font-size:12px;line-height:1.7;margin-top:12px}.login-skip{width:100%;margin-top:10px;text-align:center}.login-secondary{border:1px solid var(--ink);padding:10px 14px;transition:transform 120ms ease,box-shadow 120ms ease}.login-secondary:hover{background:var(--ink);color:var(--paper)}.login-secondary:active{transform:translateY(2px);box-shadow:inset 0 2px 0 var(--ink)}.library-panel{padding:16px 0}.library-panel h2{font-size:30px;line-height:1.4;letter-spacing:-1px;font-weight:500;margin:24px 0 14px}.library-help{font-size:14px;line-height:1.8;margin-bottom:20px}.library-open-button{width:100%;padding:10px 14px;margin:0 0 18px;background:transparent;border:1px solid var(--ink);font-size:13px;text-align:left}.library-open-button:hover{background:var(--ink);color:var(--paper)}.save-shot-button{width:100%;margin:12px 0 8px}.save-feedback{display:block;min-height:17px;margin:0 0 16px;font:11px 'Courier New',monospace;letter-spacing:.3px}.saved-shot-list{display:grid;gap:8px}.saved-shot-card{display:flex;align-items:center;gap:12px;width:100%;padding:8px;text-align:left;background:transparent;border:1px solid var(--ink);min-height:64px}.saved-shot-card:hover{background:var(--ink);color:var(--paper)}.saved-shot-card:active{transform:translateY(2px)}.saved-shot-main{display:flex;align-items:center;gap:12px;flex:1;text-align:left;background:transparent;border:0;padding:4px;color:inherit}.saved-shot-main:hover{color:inherit}.saved-shot-actions{display:flex;gap:5px}.saved-shot-actions button{background:transparent;border:1px solid currentColor;padding:5px 7px;font-size:10px;color:inherit}.saved-shot-actions button:hover{background:currentColor;color:var(--paper)}.saved-shot-title-input{width:100%;background:var(--paper);border:1px solid currentColor;padding:5px;color:var(--ink);font:14px 'Malgun Gothic',sans-serif}.saved-shot-card strong{display:block;font-size:14px;font-weight:500}.saved-shot-card small{display:block;font:11px/1.5 'Courier New',monospace;margin-top:3px}.saved-shot-index{font:12px 'Courier New',monospace}.saved-shot-card>span:last-child{margin-left:auto}.controls-hint{position:absolute;left:50%;top:50%;z-index:4;transform:translate(-50%,-50%);width:min(330px,calc(100% - 32px));padding:22px;background:rgba(242,233,218,.96);border:1px solid var(--ink);box-shadow:8px 8px 0 rgba(27,26,23,.12);text-align:center}.controls-hint h3{margin:0 0 8px;font-size:18px;font-weight:500}.controls-hint p{margin:0 0 16px;font-size:12px;line-height:1.7}.controls-hint-list{display:grid;gap:7px;text-align:left;margin-bottom:18px}.controls-hint-list span{display:flex;justify-content:space-between;border-bottom:1px solid rgba(27,26,23,.25);padding-bottom:6px;font:11px 'Courier New','Malgun Gothic',monospace}.controls-hint-list b,.controls-hint-list em{font-style:normal}.controls-hint button{width:100%;border:1px solid var(--ink);padding:9px;background:var(--ink);color:var(--paper)}@media(max-width:760px){.script-panel{padding:0}.script-panel h2{font-size:25px}.script-panel textarea{min-height:160px}.workspace .viewer{position:relative;top:auto}.login-panel{padding:0}.login-panel h2{font-size:26px}.library-panel{padding:0}.library-panel h2{font-size:26px}.saved-shot-actions button{font-size:9px;padding:4px 5px}}`}</style>
    <header className="masthead"><a className="brand" href="/" aria-label="촬영 구도 실험실 처음으로"><span className="brand-icon" aria-hidden="true">◧</span><span>SHOT LAB<span className="brand-ko">촬영 구도 실험실</span></span></a><span className="edition">CAMERA STUDY <span>/</span> {pageNumber}</span></header>
    <section className={loginPage?'login-page':(entered||libraryPage)?'workspace':scriptPage?'script-page':'intro'}>
      <div className="heading"><div><p className="eyebrow">{loginPage?'WELCOME TO SHOT LAB':libraryPage?'SHOT LIBRARY / LOCAL DEMO':entered?'THE CAMERA IS YOURS':scriptPage?'SCRIPT TO SCENE / DEMO':'A SMALL STUDY OF PERSPECTIVE'}</p><h1>{loginPage?'촬영 구도 실험실':libraryPage?'촬영 구도 저장소':entered?'카메라를 움직여 보세요.':scriptPage?'장면을 글로 써보세요.':<>같은 장면,<br/>다른 카메라.</>}</h1></div>{entered?<button className="text-button" onClick={libraryPage?closeLibrary:openScript}>{libraryPage?'← 촬영 실험':'← 스크립트 작성'}</button>:scriptPage?<button className="text-button" onClick={openIntro}>← 시작 화면</button>:loginPage?<span className="edition">DEMO ACCESS <span>/</span> 001</span>:<p className="intro-copy">촬영을 처음 배우는 사람을 위한 작은 실험실.<br/>각도와 움직임만 바꿔도, 장면은 달라집니다.</p>}</div>
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
            {entered&&!libraryPage&&showControlsHint&&ready&&!error&&(
              <div className="controls-hint" role="dialog" aria-label="장면 조작 안내">
                <h3>카메라를 직접 움직여 보세요</h3>
                <p>같은 장면도 카메라를 어디에 두느냐에 따라 다르게 보입니다.</p>
                <div className="controls-hint-list"><span><b>좌클릭 드래그</b><em>회전</em></span><span><b>우클릭 드래그</b><em>프레이밍</em></span><span><b>마우스 휠</b><em>줌</em></span></div>
                <button type="button" onClick={()=>setShowControlsHint(false)}>확인했어요</button>
              </div>
            )}
            {(!ready||error)&&<div className="stage-notice" role={error?'alert':'status'}><p>{error||'장면을 준비하고 있어요.'}</p>{error&&<button onClick={()=>setRetry(r=>r+1)}>다시 불러오기</button>}</div>}
          </div>
          <div className="viewer-caption"><span>{entered?'↔ ↕ 회전 · 우클릭 상하좌우 이동 · 휠 줌':'의자에 앉아 책을 읽는 인물'}</span><span className="mono">{entered?`${Math.round(degrees)}° / ${livePitchDeg>=0?'+':''}${livePitchDeg}° · ${framingLabel} · ${(view.zoom||1.0).toFixed(1)}x`:'16 : 9'}</span></div>
          {entered&&<div className="transport"><div className="transport-top"><span className="status" role="status">{status}</span><span className="mono">{method.duration?`${(view.progress*method.duration).toFixed(1)} / ${method.duration.toFixed(1)} s`:'— / —'}</span></div><div className="progress" role="progressbar" aria-label="촬영 재생 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(view.progress*100)}><span style={{width:`${view.progress*100}%`}}/></div>{method.duration>0?<div className="play-controls"><button disabled={!ready||!!error} onClick={()=>view.progress>=1||view.adjusted?restart():commit({playing:!view.playing})}>{view.playing?'Ⅱ 일시정지':view.adjusted?'▷ 이 방향에서 재생':view.progress>=1?'▷ 다시 재생':'▷ 계속 재생'}</button><button disabled={!ready||!!error} className="text-button" onClick={restart}>↺ 처음부터</button></div>:<p className="fixed-note">카메라는 멈춰 있어요. 다른 각도를 선택하거나 장면을 돌려보세요.</p>}</div>}
        </section>
        {loginPage?<aside className="login-panel"><span className="section-number">01 / DEMO LOGIN</span><h2>장면 실험을<br/>시작해 보세요.</h2><p className="login-help">촬영 방법을 직접 눌러보고, 같은 장면이 어떻게 달라지는지 확인할 수 있습니다.</p><form className="login-form" onSubmit={demoLogin}><label className="login-label" htmlFor="login-email">이메일</label><input className="login-input" id="login-email" type="email" placeholder="you@example.com" autoComplete="email"/><label className="login-label" htmlFor="login-password">비밀번호</label><input className="login-input" id="login-password" type="password" placeholder="••••••••" autoComplete="current-password"/><button className="primary" type="submit">로그인 (데모) <span>↗</span></button></form><p className="login-demo-note">이 화면은 목업 시연용입니다. 입력한 정보는 저장되거나 확인되지 않습니다.</p><button className="text-button login-skip" type="button" onClick={()=>setLoginPage(false)}>로그인 없이 둘러보기</button><button className="text-button login-skip login-secondary" type="button">회원가입</button></aside>:libraryPage?<aside className="library-panel"><div className="script-panel-label"><span className="section-number">05 / SHOT LIBRARY</span><span className="demo-badge">LOCAL DEMO</span></div><h2>촬영 구도 저장소</h2><p className="library-help">마음에 든 구도를 저장하고 다시 불러오세요. 이 목업에서는 현재 화면 안에서만 유지됩니다.</p><button className="primary save-shot-button" type="button" onClick={saveCurrentShot}>현재 구도 저장 <span>＋</span></button><span className="save-feedback" role="status">{saveFeedback||`저장된 구도 ${savedShots.length}개`}</span><div className="saved-shot-list">{savedShots.map((shot,i)=>{const m=METHODS.find(item=>item.id===shot.method);const deg=Math.round((((shot.angle*180/Math.PI)%360)+360)%360);return <div className="saved-shot-card" key={shot.id}><button className="saved-shot-main" type="button" onClick={()=>loadShot(shot)}><span className="saved-shot-index">{String(i+1).padStart(2,'0')}</span><span>{editingShotId===shot.id?<input className="saved-shot-title-input" value={editingShotTitle} onChange={e=>setEditingShotTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')finishRename();if(e.key==='Escape'){setEditingShotId(null);setEditingShotTitle('');}}} onClick={e=>e.stopPropagation()} autoFocus/>:<><strong>{shot.title}</strong><small>{m?.name||'촬영'} · {shot.date||DEMO_DATE}<br/>{m?.english||'SHOT'} · {deg}° · {shot.zoom.toFixed(1)}x</small></>}</span></button><span className="saved-shot-actions"><button type="button" onClick={()=>editingShotId===shot.id?finishRename():startRename(shot)}>{editingShotId===shot.id?'저장':'이름 변경'}</button><button type="button" onClick={()=>removeShot(shot.id)}>삭제</button></span></div>})}</div></aside>:entered?<aside className="controls">
          <div className="control-heading"><span className="section-number">01</span><h2>촬영 방법</h2><span className="control-count">{METHODS.length} METHODS</span></div><button className="library-open-button" type="button" onClick={openLibrary}>촬영 구도 저장소 열기 ↗</button><button className="primary save-shot-button" type="button" onClick={saveCurrentShot}>현재 구도 저장 <span>＋</span></button><span className="save-feedback" role="status">{saveFeedback||`저장된 구도 ${savedShots.length}개`}</span>
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
        </aside>:scriptPage?<aside className="script-panel"><div className="script-panel-label"><span className="section-number">02 / SCRIPT TO SCENE</span><span className="demo-badge">DEMO · AI 없음</span></div><h2>텍스트가 장면이 되는<br/>과정을 미리 봅니다.</h2><p className="script-help">짧은 촬영 스크립트를 적어 보세요. 실제 AI 대신 준비된 3D 장면을 연결해 보여주는 시연 버전입니다.</p><label className="script-label" htmlFor="script-input">촬영 스크립트</label><textarea id="script-input" value={scriptText} onChange={e=>setScriptText(e.target.value)} spellCheck="false"/><div className="script-meta"><span>{scriptText.length}자</span><span>장면 01 · 인물</span></div><button className="primary" disabled={!ready||!!error||!scriptText.trim()||demoLoading} onClick={drawDemo}>{demoLoading?'3D 장면을 준비하는 중…':'AI 장면 그리기 (데모)'} <span>{demoLoading?'…':'↗'}</span></button><button className="text-button script-back" onClick={openIntro}>스크립트 없이 바로 둘러보기</button></aside>:<aside className="intro-panel"><span className="section-number">01 / CAMERA EXPERIMENT</span><h2>어디서,<br/>어떻게 바라볼까요?</h2><p>책을 읽는 인물과 작은 공간.<br/>카메라를 가까이, 멀리, 주변으로<br className="desktop-break"/> 움직이며 구도를 확인해 보세요.</p><div className="intro-tags"><span>고정 각도 4개</span><span>이동 촬영 9종</span><span>스크립트 → 3D 데모</span></div><button className="primary" disabled={!ready||!!error} onClick={openScript}>스크립트로 장면 만들기 <span>↗</span></button><button className="text-button intro-direct" disabled={!ready||!!error} onClick={()=>setEntered(true)}>준비된 장면 바로 둘러보기 ↗</button><button className="text-button intro-direct intro-library" disabled={!ready||!!error} onClick={openLibrary}>촬영 구도 저장소 바로가기 ↗</button><p className="intro-hint">직접 누르고, 돌려보며 이해하는 촬영</p></aside>}
      </div>
    </section>
    <footer><span>가상 장면 · 구도 이해를 위한 시연용 애니메이션</span><span>SHOT LAB / 첫 번째 장면</span></footer>
  </main>;
}


