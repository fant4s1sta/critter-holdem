import { useEffect, useRef, useState } from 'react';
import { CRITTERS, CRITTER_KINDS, type CritterKind } from '@/lib/critters';
import styles from './CritterCarousel.module.css';

export function CritterCarousel({ value, disabled, onChange }: {
  value: CritterKind; disabled: boolean; onChange: (kind: CritterKind) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef<{ select: (kind: CritterKind) => void } | null>(null);
  const current = useRef(value);
  const [status, setStatus] = useState('正在请小伙伴入场…');
  useEffect(() => {
    const controller = new AbortController();
    const element = host.current!;
    void import('@/lib/panda3d/carousel').then(({ createCritterCarousel }) =>
      createCritterCarousel(element, current.current, controller.signal)
    ).then(scene => {
      if (controller.signal.aborted) return;
      runtime.current = scene;
      scene.select(current.current);
      setStatus('');
    }).catch(() => {
      if (!controller.signal.aborted) setStatus('模型加载失败，请刷新重试');
    });
    return () => { controller.abort(); runtime.current = null; };
  }, []);
  useEffect(() => { current.current = value; runtime.current?.select(value); }, [value]);
  const index = CRITTER_KINDS.indexOf(value);
  const previous = CRITTER_KINDS[(index + CRITTER_KINDS.length - 1) % CRITTER_KINDS.length];
  const next = CRITTER_KINDS[(index + 1) % CRITTER_KINDS.length];
  return <section className={styles.carousel} aria-label="选择小动物角色" aria-roledescription="旋转木马"
    onKeyDown={event => {
      if (disabled || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); onChange(event.key === 'ArrowLeft' ? previous : next);
    }}>
    <span className={styles.caption}>我的牌桌伙伴</span>
    <div ref={host} className={styles.stage} aria-hidden="true" />
    {status && <span className={styles.loading} role="status">{status}</span>}
    <button className={styles.previous} aria-label={`选择${CRITTERS[previous].name}`} disabled={disabled} onClick={() => onChange(previous)}>‹</button>
    <button className={styles.next} aria-label={`选择${CRITTERS[next].name}`} disabled={disabled} onClick={() => onChange(next)}>›</button>
    <div className={styles.selected} aria-live="polite"><strong>{CRITTERS[value].name}</strong><span>已选择 · {index + 1} / {CRITTER_KINDS.length}</span></div>
  </section>;
}
