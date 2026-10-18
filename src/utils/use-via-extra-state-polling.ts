import {useEffect} from 'react';
import {useAppDispatch, useAppSelector} from 'src/store/hooks';
import {getViaExtraCaps, pollViaExtraState} from 'src/store/viaExtraSlice';

const POLL_INTERVAL_MS = 400;

// Polls GET_STATE (which layer the keyboard is on) while the keyboard supports
// it and the browser tab is visible. The next poll is scheduled only after the
// previous one finished, so polls never pile up in the HID command queue.
export const useViaExtraStatePolling = () => {
  const dispatch = useAppDispatch();
  const hasState = !!useAppSelector(getViaExtraCaps)?.hasState;

  useEffect(() => {
    if (!hasState) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState === 'visible') {
        await dispatch(pollViaExtraState());
      }
      if (!cancelled) {
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [hasState, dispatch]);
};
