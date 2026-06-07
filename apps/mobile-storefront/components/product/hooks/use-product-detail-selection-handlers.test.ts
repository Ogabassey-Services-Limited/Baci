import { describe, expect, it, jest } from '@jest/globals';
import { useProductDetailSelectionHandlers } from './use-product-detail-selection-handlers';

const redmi15Variants = [
  {
    id: 'redmi-15-6-128',
    name: '6GB 128GB',
    condition: 'new',
    price: 212651.16,
    stock_quantity: 0,
    attributes: { ram: '6GB', storage: '128GB' },
  },
  {
    id: 'redmi-15-8-256',
    name: '8GB 256GB',
    condition: 'new',
    price: 230604.65,
    stock_quantity: 0,
    attributes: { ram: '8GB', storage: '256GB' },
  },
];

function createRouteData() {
  return {
    effectiveSelectedAttributes: { ram: '6GB' },
    effectiveSelectedColor: null,
    effectiveSelectedCondition: 'new',
    effectiveSelectedStorage: '128GB',
    product: {
      id: 'redmi-15',
      name: 'Redmi 15',
      slug: 'redmi-15',
      price: 212651.16,
      image: 'https://cdn.example.com/redmi-15.jpg',
      has_variants: true,
      manage_stock: false,
      variants: redmi15Variants,
    },
    productGalleryImages: [],
    productImageColorMap: {},
    resolvedColorImages: undefined,
    selectedImageIndex: 0,
    setHasCustomizedSelection: jest.fn(),
    setSelectedAttributes: jest.fn(),
    setSelectedColor: jest.fn(),
    setSelectedImageIndex: jest.fn(),
    setSelectedStorage: jest.fn(),
    setSelectedVariant: jest.fn(),
    usesImageDrivenColorSelection: false,
    usesVariantConditions: true,
  };
}

function resolveAttributeUpdate(
  updater: Record<string, string> | ((current: Record<string, string>) => Record<string, string>)
) {
  return typeof updater === 'function' ? updater({ ram: '6GB' }) : updater;
}

function getAttributeUpdater(routeData: ReturnType<typeof createRouteData>) {
  return routeData.setSelectedAttributes.mock.calls[0][0] as Parameters<
    typeof resolveAttributeUpdate
  >[0];
}

describe('useProductDetailSelectionHandlers', () => {
  it('selects the reachable storage when a RAM choice only exists with another storage', () => {
    const routeData = createRouteData();
    const handlers = useProductDetailSelectionHandlers(routeData as never);

    handlers.onSelectAttribute('ram', '8GB');

    expect(routeData.setSelectedStorage).toHaveBeenCalledWith('256GB');
    expect(routeData.setSelectedAttributes).toHaveBeenCalledTimes(1);
    expect(resolveAttributeUpdate(getAttributeUpdater(routeData))).toEqual({
      ram: '8GB',
    });
    expect(routeData.setSelectedVariant).toHaveBeenCalledWith(null);
  });

  it('selects the reachable RAM when a storage choice only exists with another RAM', () => {
    const routeData = createRouteData();
    const handlers = useProductDetailSelectionHandlers(routeData as never);

    handlers.onSelectStorage('256GB');

    expect(routeData.setSelectedStorage).toHaveBeenCalledWith('256GB');
    expect(routeData.setSelectedAttributes).toHaveBeenCalledTimes(1);
    expect(resolveAttributeUpdate(getAttributeUpdater(routeData))).toEqual({
      ram: '8GB',
    });
    expect(routeData.setSelectedVariant).toHaveBeenCalledWith(null);
  });

  it('keeps a direct attribute selection when no linked variant exists', () => {
    const routeData = createRouteData();
    const handlers = useProductDetailSelectionHandlers(routeData as never);

    handlers.onSelectAttribute('ram', '12GB');

    expect(routeData.setSelectedStorage).not.toHaveBeenCalled();
    expect(routeData.setSelectedAttributes).toHaveBeenCalledTimes(1);
    expect(resolveAttributeUpdate(getAttributeUpdater(routeData))).toEqual({
      ram: '12GB',
    });
    expect(routeData.setSelectedVariant).toHaveBeenCalledWith(null);
  });

  it('keeps a direct storage selection when no linked variant exists', () => {
    const routeData = createRouteData();
    const handlers = useProductDetailSelectionHandlers(routeData as never);

    handlers.onSelectStorage('512GB');

    expect(routeData.setSelectedStorage).toHaveBeenCalledWith('512GB');
    expect(routeData.setSelectedAttributes).not.toHaveBeenCalled();
    expect(routeData.setSelectedVariant).toHaveBeenCalledWith(null);
  });
});
