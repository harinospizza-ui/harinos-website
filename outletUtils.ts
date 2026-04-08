import { CustomerLocation, OutletConfig } from './types';

export interface OutletMatch {
  outlet: OutletConfig;
  distanceKm: number;
}

interface RoadDistanceApiResponse {
  code?: string;
  routes?: Array<{
    distance: number;
  }>;
}

const ROAD_DISTANCE_API_URL = (
  import.meta.env.VITE_ROAD_DISTANCE_API_URL || 'https://router.project-osrm.org'
).replace(/\/$/, '');

export const buildCustomerMapUrl = (latitude: number, longitude: number): string =>
  `https://maps.google.com/?q=${latitude},${longitude}`;

export const sanitizePhoneNumber = (phone: string): string => phone.replace(/\D/g, '');

export const getRoadDistanceKm = async (
  customerLocation: CustomerLocation,
  outlet: OutletConfig,
): Promise<number> => {
  const requestUrl =
    `${ROAD_DISTANCE_API_URL}/route/v1/driving/` +
    `${customerLocation.longitude},${customerLocation.latitude};${outlet.longitude},${outlet.latitude}` +
    '?overview=false&alternatives=false&steps=false';

  const response = await fetch(requestUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Road distance lookup failed with status ${response.status}.`);
  }

  const data = (await response.json()) as RoadDistanceApiResponse;
  const route = data.routes?.[0];

  if (data.code !== 'Ok' || !route) {
    throw new Error('Road distance lookup did not return a valid route.');
  }

  return route.distance / 1000;
};

export const findNearestOutletByRoadDistance = async (
  customerLocation: CustomerLocation,
  outlets: OutletConfig[],
): Promise<OutletMatch | null> => {
  const activeOutlets = outlets.filter((outlet) => outlet.enabled);
  if (!activeOutlets.length) {
    return null;
  }

  const outletMatches = await Promise.all(
    activeOutlets.map(async (outlet) => ({
      outlet,
      distanceKm: await getRoadDistanceKm(customerLocation, outlet),
    })),
  );

  if (!outletMatches.length) {
    return null;
  }

  return outletMatches.reduce<OutletMatch>((closestOutlet, outletMatch) => {
    if (outletMatch.distanceKm < closestOutlet.distanceKm) {
      return outletMatch;
    }

    return closestOutlet;
  }, outletMatches[0]);
};
