import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';

// The paper page keeps its analysis panels mounted, so its DOM is large and a role query on it can take
// longer than the 1 s default on a loaded CI runner. A slower pass is better than a flaky one.
configure({ asyncUtilTimeout: 4000 });
afterEach(cleanup);
