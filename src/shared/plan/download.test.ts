import { expect, it, vi } from 'vitest';
import { download } from './download';

it('PK-05 downloads the supplied bytes and revokes the URL', () => {
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  download('plan.zip', new Uint8Array([1, 2]));
  expect(create.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
  expect(click).toHaveBeenCalledOnce();
  expect(revoke).toHaveBeenCalledWith('blob:test');
  create.mockRestore();
  revoke.mockRestore();
  click.mockRestore();
});
