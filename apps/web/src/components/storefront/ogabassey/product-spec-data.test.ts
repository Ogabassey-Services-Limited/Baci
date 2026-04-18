import { describe, expect, it } from 'vitest';
import { buildOgabasseyProductSpecData } from './product-spec-data';

describe('buildOgabasseyProductSpecData', () => {
  it('extracts key specs from the description table when explicit spec fields are missing', () => {
    const description = `
      <h2>What is the Samsung Galaxy Z TriFold Price in Nigeria?</h2>
      <p>Flagship foldable.</p>
      <h2>Key Specs at a Glance</h2>
      <table>
        <thead>
          <tr><th>Feature</th><th>What You Get</th></tr>
        </thead>
        <tbody>
          <tr><td>Display</td><td>Triple-fold AMOLED - up to 10&quot; unfolded</td></tr>
          <tr><td>Processor</td><td>Snapdragon 8 Elite for Galaxy</td></tr>
          <tr><td>RAM</td><td>16GB</td></tr>
          <tr><td>Storage</td><td>512GB</td></tr>
          <tr><td>Camera</td><td>200MP main + ultrawide + telephoto</td></tr>
          <tr><td>Battery</td><td>5600mAh, 65W fast charging</td></tr>
          <tr><td>OS</td><td>Android 15 with One UI 7 + Galaxy AI</td></tr>
        </tbody>
      </table>
    `;

    const result = buildOgabasseyProductSpecData({
      brand: 'Samsung',
      category: 'Smartphones',
      condition: 'new',
      description,
      variant_attributes: {
        ram: ['16GB'],
        storage: ['512GB'],
        sim_type: ['Physical + eSIM'],
      },
    });

    expect(result.detailedSpecs).toEqual(
      expect.arrayContaining([
        {
          category: 'Key Specs',
          items: expect.arrayContaining([
            { label: 'Display', value: 'Triple-fold AMOLED - up to 10" unfolded' },
            { label: 'Processor', value: 'Snapdragon 8 Elite for Galaxy' },
            { label: 'RAM', value: '16GB' },
            { label: 'Storage', value: '512GB' },
            { label: 'Camera', value: '200MP main + ultrawide + telephoto' },
            { label: 'Battery', value: '5600mAh, 65W fast charging' },
            { label: 'OS', value: 'Android 15 with One UI 7 + Galaxy AI' },
          ]),
        },
        {
          category: 'General',
          items: expect.arrayContaining([
            { label: 'Brand', value: 'Samsung' },
            { label: 'Category', value: 'Smartphones' },
            { label: 'SIM', value: 'Physical + eSIM' },
          ]),
        },
      ])
    );

    expect(result.specs).toEqual(
      expect.arrayContaining([
        { label: 'Display', value: 'Triple-fold AMOLED - up to 10" unfolded' },
        { label: 'Processor', value: 'Snapdragon 8 Elite for Galaxy' },
        { label: 'RAM', value: '16GB' },
        { label: 'Storage', value: '512GB' },
        { label: 'Camera', value: '200MP main + ultrawide + telephoto' },
        { label: 'Battery', value: '5600mAh, 65W fast charging' },
        { label: 'OS', value: 'Android 15 with One UI 7 + Galaxy AI' },
      ])
    );
  });

  it('falls back to general specs when no description table or structured specs exist', () => {
    const result = buildOgabasseyProductSpecData({
      brand: 'Samsung',
      category: 'Smartphones',
      condition: 'new',
      variant_attributes: {
        ram: ['12GB'],
        storage: ['256GB'],
      },
    });

    expect(result.detailedSpecs).toEqual([
      {
        category: 'General',
        items: [
          { label: 'Brand', value: 'Samsung' },
          { label: 'Condition', value: 'new' },
          { label: 'Category', value: 'Smartphones' },
          { label: 'RAM', value: '12GB' },
          { label: 'Storage', value: '256GB' },
        ],
      },
    ]);
  });
});
