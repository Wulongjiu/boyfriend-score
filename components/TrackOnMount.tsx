'use client';

import { useEffect } from 'react';

import { track } from '../lib/analytics';
import type { EventPayload, FunnelEvent } from '../lib/analytics-events';

/**
 * 挂载即上报（用于服务端组件里的曝光事件）
 *
 * 为什么需要它：首页、结果页是服务端组件，不能直接调用客户端埋点。
 * 这个组件只做一件事——挂载后上报一次事件，不渲染任何内容。
 *
 * 幂等由 lib/analytics.ts 的 ONCE_EVENTS 保证：即使因 React 严格模式
 * 或路由切换导致重复挂载，同一会话内也只会真正上报一次。
 */
export default function TrackOnMount({
  event,
  payload,
}: {
  event: FunnelEvent;
  payload?: EventPayload;
}) {
  useEffect(() => {
    track(event, payload);
    // payload 是调用处写死的字面量，不需要作为依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  return null;
}
