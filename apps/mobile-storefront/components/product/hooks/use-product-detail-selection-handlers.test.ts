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

function createRouteData(overrides: Record<string, unknown> = {}) {
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
    setSelectedCondition: jest.fn(),
    setSelectedImageIndex: jest.fn(),
    setSelectedStorage: jest.fn(),
    setSelectedVariant: jest.fn(),
    usesImageDrivenColorSelection: false,
    usesVariantConditions: true,
    ...overrides,
  };
}

function resolveAttributeUpdate(
  updater:
    | Record<string, string>
    | ((current: Record<string, string>) => Record<string, string>)
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

  it('selects the reachable memory configuration when a color only exists on another variant', () => {
    const routeData = createRouteData({
      effectiveSelectedAttributes: { ram: '6GB' },
      effectiveSelectedColor: 'Black',
      effectiveSelectedStorage: '128GB',
      product: {
        id: 'phone-with-colors',
        name: 'Phone With Colors',
        slug: 'phone-with-colors',
        price: 212651.16,
        image: 'https://cdn.example.com/phone.jpg',
        has_variants: true,
        manage_stock: false,
        variants: [
          {
            id: 'black-6-128',
            name: '6GB 128GB Black',
            condition: 'new',
            price: 1,
            attributes: {
              color: 'Black',
              ram: '6GB',
              storage: '128GB',
            },
          },
          {
            id: 'blue-8-256',
            name: '8GB 256GB Blue',
            condition: 'new',
            price: 1,
            attributes: {
              color: 'Blue',
              ram: '8GB',
              storage: '256GB',
            },
          },
        ],
      },
    });
    const handlers = useProductDetailSelectionHandlers(routeData as never);

    handlers.onSelectColor('Blue');

    expect(routeData.setSelectedColor).toHaveBeenCalledWith('Blue');
    expect(routeData.setSelectedStorage).toHaveBeenCalledWith('256GB');
    expect(routeData.setSelectedAttributes).toHaveBeenCalledTimes(1);
    expect(resolveAttributeUpdate(getAttributeUpdater(routeData))).toEqual({
      ram: '8GB',
    });
    expect(routeData.setSelectedVariant).toHaveBeenCalledWith(null);
  });

  it('updates the gallery image when a linked storage selection changes color', () => {
    const routeData = createRouteData({
      effectiveSelectedAttributes: { ram: '6GB' },
      effectiveSelectedColor: 'Black',
      effectiveSelectedStorage: '128GB',
      productGalleryImages: [
        'https://cdn.example.com/black.jpg',
        'https://cdn.example.com/blue.jpg',
      ],
      resolvedColorImages: {
        Black: ['https://cdn.example.com/black.jpg'],
        Blue: ['https://cdn.example.com/blue.jpg'],
      },
      product: {
        id: 'phone-with-color-linked-storage',
        name: 'Phone With Color Linked Storage',
        slug: 'phone-with-color-linked-storage',
        price: 212651.16,
        image: 'https://cdn.example.com/black.jpg',
        has_variants: true,
        manage_stock: false,
        variants: [
          {
            id: 'black-6-128',
            name: '6GB 128GB Black',
            condition: 'new',
            price: 1,
            attributes: {
              color: 'Black',
              ram: '6GB',
              storage: '128GB',
            },
          },
          {
            id: 'blue-8-256',
            name: '8GB 256GB Blue',
            condition: 'new',
            price: 1,
            attributes: {
              color: 'Blue',
              ram: '8GB',
              storage: '256GB',
            },
          },
        ],
      },
    });
    const handlers = useProductDetailSelectionHandlers(routeData as never);

    handlers.onSelectStorage('256GB');

    expect(routeData.setSelectedColor).toHaveBeenCalledWith('Blue');
    expect(routeData.setSelectedStorage).toHaveBeenCalledWith('256GB');
    expect(routeData.setSelectedImageIndex).toHaveBeenCalledWith(1);
  });

  it('stores condition as an attribute when condition is attribute-backed', () => {
    const routeData = createRouteData({
      effectiveSelectedAttributes: { condition: 'used', storage: '128GB' },
      usesVariantConditions: false,
    });
    const handlers = useProductDetailSelectionHandlers(routeData as never);

    handlers.onSelectCondition('open_box');

    expect(routeData.setSelectedCondition).toHaveBeenCalledWith('open_box');
    expect(routeData.setSelectedVariant).toHaveBeenCalledWith(null);
    expect(routeData.setSelectedAttributes).toHaveBeenCalledTimes(1);
    expect(
      (
        routeData.setSelectedAttributes.mock.calls[0][0] as (
          current: Record<string, string>
        ) => Record<string, string>
      )({ condition: 'used', storage: '128GB' })
    ).toEqual({ condition: 'open_box', storage: '128GB' });
  });
});
