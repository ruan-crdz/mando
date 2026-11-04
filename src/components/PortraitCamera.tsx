import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Sparkles, UserRound } from 'lucide-react';
import { Modal } from './ui';

/** Tamanho do recorte quadrado enviado para a IA (JPEG leve, ~60 KB). */
const SIZE = 640;

/**
 * Captura o rosto do jogador pela webcam. A foto vira referência para a IA
 * desenhar o manager no estilo de jogo; sem câmera, segue só com a descrição.
 */
export function PortraitCamera({
  style,
  onCapture,
  onClose,
}: {
  style: string;
  onCapture: (photo: string | undefined) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string>();
  const [state, setState] = useState<'loading' | 'live' | 'denied'>('loading');
  useEffect(() => {
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('denied');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
        setState('live');
      })
      .catch(() => {
        if (!cancelled) setState('denied');
      });
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (!photo && state === 'live' && video.current && stream.current) {
      video.current.srcObject = stream.current;
      void video.current.play();
    }
  }, [photo, state]);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('[data-autofocus]:not(:disabled)')?.focus();
  }, [photo, state]);
  const capture = () => {
    const v = video.current;
    if (!v?.videoWidth) return;
    const side = Math.min(v.videoWidth, v.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;
    // Espelha como na prévia: o jogador vê a mesma foto que posou.
    ctx.translate(SIZE, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      v,
      (v.videoWidth - side) / 2,
      (v.videoHeight - side) / 2,
      side,
      side,
      0,
      0,
      SIZE,
      SIZE,
    );
    setPhoto(canvas.toDataURL('image/jpeg', 0.86));
  };
  return (
    <Modal title="Retrato do manager" onClose={onClose} wide>
      <div className="portrait-camera" ref={panel}>
        <div className={`camera-frame ${state}`}>
          {photo ? (
            <img src={photo} alt="Sua foto" />
          ) : (
            <video ref={video} muted playsInline aria-label="Prévia da câmera" />
          )}
          {!photo && state === 'live' && <i className="face-guide" aria-hidden="true" />}
          {state === 'loading' && <p>Abrindo a câmera…</p>}
          {state === 'denied' && (
            <p>
              <UserRound size={40} />
              Câmera indisponível ou bloqueada. Libere a câmera no navegador ou gere pela descrição.
            </p>
          )}
        </div>
        <div className="camera-side">
          <p className="eyebrow">COMO FUNCIONA</p>
          <h3>Seu rosto no jogo</h3>
          <p>
            Tiramos uma foto sua e a IA transforma você em um manager com visual de jogo de futebol,
            usando a roupa escolhida: <b>{style}</b>.
          </p>
          <p className="muted small">A foto só é usada para gerar o retrato e não fica salva.</p>
          <div className="camera-actions">
            {photo ? (
              <>
                <button className="primary" data-autofocus onClick={() => onCapture(photo)}>
                  <Sparkles size={18} /> Gerar com esta foto
                </button>
                <button onClick={() => setPhoto(undefined)}>
                  <RefreshCw size={18} /> Tirar outra
                </button>
              </>
            ) : (
              <button
                className="primary"
                data-autofocus
                disabled={state !== 'live'}
                onClick={capture}
              >
                <Camera size={18} /> Tirar foto
              </button>
            )}
            <button onClick={() => onCapture(undefined)}>
              <UserRound size={18} /> Gerar pela descrição
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
