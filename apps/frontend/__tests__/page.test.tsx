import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from '../src/app/page';
import { Providers } from '../src/app/providers';

vi.mock('../src/shared/api/http-client', () => {
  return {
    httpClient: {
      get: vi.fn().mockImplementation((url: string) => {
        if (String(url).includes('/api/sources')) {
          return Promise.resolve({
            data: { total: 0, sources: [] },
          });
        }
        return Promise.resolve({
          data: { data: [], total: 0, page: 1, limit: 20 },
        });
      }),
      post: vi.fn().mockResolvedValue({ data: { created: 0, enqueued: 0 } }),
    },
  };
});

test('Home page renders heading', () => {
  render(
    <Providers>
      <Page />
    </Providers>,
  );
  expect(
    screen.getByRole('heading', {
      level: 1,
      name: /fake news generator/i,
    }),
  ).toBeDefined();
});
