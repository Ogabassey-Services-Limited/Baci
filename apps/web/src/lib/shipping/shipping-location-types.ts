export interface NigerianState {
  name: string;
  code: string;
  cities: NigerianCity[];
}

export interface NigerianCity {
  name: string;
  stationId?: number;
  stationName?: string;
}

export interface UnifiedLocation {
  state: string;
  city: string;
  displayName?: string;
  stationId?: number;
  stationName?: string;
  latitude?: number;
  longitude?: number;
}
