import { beforeEach, describe, expect, it, vi } from 'vitest';
import axiosInstance from './axiosInstance';
import { getAppStats } from './stats';

vi.mock('./axiosInstance', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('app stats cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('deduplicates concurrent app stats requests', async () => {
    let resolveRequest;
    axiosInstance.get.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    const first = getAppStats();
    const second = getAppStats();

    expect(axiosInstance.get).toHaveBeenCalledTimes(1);
    resolveRequest({ data: { LICENSE_VALID: true, TIMEZONE: 'UTC' } });

    await expect(first).resolves.toMatchObject({ LICENSE_VALID: true });
    await expect(second).resolves.toMatchObject({ LICENSE_VALID: true });
  });

  it('reuses fresh session-cached app stats', async () => {
    axiosInstance.get.mockResolvedValue({ data: { LICENSE_VALID: false, TIMEZONE: 'Europe/Berlin' } });

    await getAppStats();
    const cached = await getAppStats();

    expect(axiosInstance.get).toHaveBeenCalledTimes(1);
    expect(cached).toMatchObject({ LICENSE_VALID: false, TIMEZONE: 'Europe/Berlin' });
  });
});
