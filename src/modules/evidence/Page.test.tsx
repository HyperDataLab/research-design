import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import facts from '../../../schemas/vendor/experiment-facts-v1.example.json';
import model from '../../../schemas/vendor/paper-model-v1.example.json';
import { addPaper, decide, emptyPapersDoc } from '@/core/papers/papers';
import { ProjectContext } from '@/shared/project/projectContext';
import { setupClient } from '@/modules/corpus/testSupport';
import Page from './Page';

function setup(readOnly = false, withFacts = true) {
  const context = setupClient();
  const id = 'p-012345abcdef';
  const added = addPaper(
    emptyPapersDoc(),
    { title: 'Paper', authors: [], year: null, venue: null, doi: null },
    'person',
    '2026-01-01T00:00:00Z',
    id,
  );
  if (!added.ok) throw Error();
  const included = decide(added.doc, id, 'included', null, 'person', '2026-01-01T00:00:00Z');
  if (!included.ok) throw Error();
  context.docs.set(`${context.project.id}/papers`, { data: included.doc, etag: '1' });
  if (withFacts)
    context.items.set(`${context.project.id}/facts/${id}`, {
      etag: '1',
      data: {
        schemaVersion: 1,
        paperId: id,
        source: { paperlabId: 'p', etag: 'e', fetchedBy: 'person', fetchedAt: '2026-01-01T00:00:00Z' },
        facts,
        decisions: {},
      },
    });
  context.items.set(`${context.project.id}/paper-models/${id}`, { etag: '1', data: model });
  render(
    <MemoryRouter>
      <context.wrapper>
        <ProjectContext.Provider value={{ project: context.project, readOnly }}>
          <Page />
        </ProjectContext.Provider>
      </context.wrapper>
    </MemoryRouter>,
  );
  return context;
}
it('FR-303 shows ordered kinds, empty cells and facts', async () => {
  setup();
  await screen.findByText('Paper');
  expect(screen.getAllByRole('columnheader').map((e) => e.textContent)).toEqual([
    'Bài báo',
    'TaskPaperLab chưa cung cấp',
    'Dataset',
    'Baseline',
    'Phương pháp',
    'Metric',
    'Thiết kếPaperLab chưa cung cấp',
    'MẫuPaperLab chưa cung cấp',
    'Kết quả',
  ]);
  expect(screen.getAllByText('Không có').length).toBeGreaterThan(0);
});
it('shows the no-facts line', async () => {
  setup(false, false);
  expect(await screen.findByText(/Chưa có dữ kiện từ PaperLab/)).toBeInTheDocument();
});
it('FR-303 archived project has no decision controls', async () => {
  setup(true);
  await screen.findByText('Paper');
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: new RegExp(facts.facts[0]!.value) }));
  expect(screen.queryByRole('button', { name: 'Dùng' })).not.toBeInTheDocument();
});
