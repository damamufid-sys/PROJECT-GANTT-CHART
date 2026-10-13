import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Vitest dikonfigurasi tanpa globals, jadi pembersihan DOM dilakukan eksplisit.
afterEach(() => {
  cleanup();
});
