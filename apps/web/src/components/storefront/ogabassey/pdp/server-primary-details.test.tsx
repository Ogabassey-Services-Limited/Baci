import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OgabasseyPdpServerPrimaryDetails } from './server-primary-details';

describe('OgabasseyPdpServerPrimaryDetails', () => {
  it('renders product overview and specs as visible crawlable HTML', () => {
    render(
      <OgabasseyPdpServerPrimaryDetails
        description="<p>Apple 20W USB-C Power Delivery adapter for supported iPhone, iPad, and AirPods devices.</p>"
        detailedSpecs={[
          {
            category: 'Charging',
            items: [
              { label: 'Power output', value: '20W USB-C' },
              { label: 'Compatibility', value: 'USB-C charging cable' },
            ],
          },
        ]}
        productName="Apple Fast Charger 20W"
      />
    );

    const region = screen.getByRole('region', {
      name: 'Apple Fast Charger 20W overview and specifications',
    });

    expect(
      within(region).getByRole('heading', {
        name: 'Apple Fast Charger 20W product overview',
      })
    ).toBeVisible();
    expect(
      within(region).getByText(/Power Delivery adapter/)
    ).toBeVisible();
    expect(within(region).getByText('Power output')).toBeVisible();
    expect(within(region).getByText('20W USB-C')).toBeVisible();
  });


  it('renders rich descriptions as text-only overview copy so inline images stay deferred', () => {
    render(
      <OgabasseyPdpServerPrimaryDetails
        description='<p>Clean iPhone with warranty.</p><img src="https://cdn.example.com/offscreen.jpg" alt="Gallery"><p>Ready for dispatch.</p>'
        detailedSpecs={[]}
        productName="iPhone 16 Pro"
      />
    );

    expect(screen.getByText('Clean iPhone with warranty. Ready for dispatch.')).toBeVisible();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders nothing when there is no useful product copy', () => {
    const { container } = render(
      <OgabasseyPdpServerPrimaryDetails
        description=" "
        detailedSpecs={[{ category: 'Empty', items: [{ label: '', value: '' }] }]}
        productName="Empty Product"
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
