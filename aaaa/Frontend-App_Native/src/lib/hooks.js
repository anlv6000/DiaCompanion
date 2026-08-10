import { useState, useEffect, useCallback } from "react";

/**
 * useAsync — chạy hàm loader mỗi khi deps đổi, trả về trạng thái tải.
 * Dùng ở màn hình: const { data, loading, error, reload } = useAsync(() => data.metrics.list(...), [deps]).
 */
export function useAsync(loader, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loader()
      .then((x) => { if (alive) setData(x); })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload, setData };
}
