import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PertDiagram } from './PertDiagram';
import { buildAnalysisFixture } from '../../test/fixtures';

const { analysis } = buildAnalysisFixture();

describe('PertDiagram', () => {
  it('merender seluruh node tugas daun', () => {
    render(<PertDiagram network={analysis.pert} />);
    for (const node of analysis.pert.nodes) {
      expect(screen.getByTestId(`pert-node-${node.id}`)).toBeInTheDocument();
    }
  });

  it('menandai node kritis dengan warna merah', () => {
    render(<PertDiagram network={analysis.pert} />);
    const critical = analysis.pert.nodes.filter((node) => node.critical);
    const notCritical = analysis.pert.nodes.filter((node) => !node.critical);
    expect(critical.length).toBeGreaterThan(0);
    expect(notCritical.length).toBeGreaterThan(0);

    for (const node of critical) {
      expect(screen.getByTestId(`pert-node-${node.id}`)).toHaveAttribute('data-critical', 'true');
    }
    for (const node of notCritical) {
      expect(screen.getByTestId(`pert-node-${node.id}`)).toHaveAttribute('data-critical', 'false');
    }
  });

  it('menampilkan informasi durasi, ES/EF, LS/LF, dan slack', () => {
    render(<PertDiagram network={analysis.pert} />);
    expect(screen.getAllByText(/Durasi: \d+ hari/).length).toBe(analysis.pert.nodes.length);
    expect(screen.getAllByText(/ES\/EF:/).length).toBe(analysis.pert.nodes.length);
    expect(screen.getAllByText(/Slack:/).length).toBe(analysis.pert.nodes.length);
  });
});
