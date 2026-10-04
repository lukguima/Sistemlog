import { supabase } from './supabase';
import { calcTripCommission, normalizeCommissionBase } from './commission';
import { utcCalendarRange, saoPauloStart, saoPauloEndExclusive } from './format';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type FuelKind = 'diesel' | 'gasolina' | 'etanol';

export function normalizeFuelType(fuelType: string | null | undefined): FuelKind {
    const t = String(fuelType || 'diesel').trim().toLowerCase();
    if (t === 'gasolina' || t === 'etanol') return t;
    return 'diesel';
}

/** diesel, vazio ou valor antigo "Diesel". Gasolina e etanol ficam de fora do KM/L. */
export function isDieselFuel(fuelType: string | null | undefined) {
    return normalizeFuelType(fuelType) === 'diesel';
}

export function fuelTypeLabel(fuelType: string | null | undefined) {
    const t = normalizeFuelType(fuelType);
    if (t === 'gasolina') return 'Gasolina';
    if (t === 'etanol') return 'Etanol';
    return 'Diesel';
}

export const fleetService = {
    async getVehicles(companyId: string) {
        if (!companyId) return [];
        const { data, error } = await supabase
            .from('vehicles')
            .select('*')
            .eq('company_id', companyId);
        if (error) throw error;
        // Espelho de agregado não entra na frota, viagens, manutenção etc.
        return (data || []).filter((v: any) => !v.agregado_id);
    },

    /** Cria/atualiza um veículo só para abastecer a placa do agregado. */
    async ensureAgregadoVehicles(companyId: string) {
        if (!companyId) return;
        try {
            const { data: agregados, error: agErr } = await supabase
                .from('agregados')
                .select('id, vehicle_plate, vehicle_model, status')
                .eq('company_id', companyId);
            if (agErr) throw agErr;
            const active = (agregados || []).filter((a: any) =>
                a.status !== 'inactive' && String(a.vehicle_plate || '').trim()
            );
            if (active.length === 0) return;

            const { data: existing, error: vErr } = await supabase
                .from('vehicles')
                .select('id, plate, model, agregado_id')
                .eq('company_id', companyId)
                .not('agregado_id', 'is', null);
            if (vErr) throw vErr;
            const byAgregado = new Map((existing || []).map((v: any) => [v.agregado_id, v]));

            for (const a of active) {
                const plate = String(a.vehicle_plate).trim().toUpperCase();
                const model = a.vehicle_model || 'Agregado';
                const mirror = byAgregado.get(a.id);
                if (mirror) {
                    if (mirror.plate !== plate || (mirror.model || '') !== model) {
                        await supabase.from('vehicles').update({ plate, model }).eq('id', mirror.id);
                    }
                } else {
                    const { error: insErr } = await supabase.from('vehicles').insert([{
                        company_id: companyId,
                        plate,
                        model,
                        category: 'truck',
                        status: 'active',
                        agregado_id: a.id,
                    }]);
                    if (insErr) console.warn('ensureAgregadoVehicles:', insErr.message);
                }
            }
        } catch (e) {
            console.warn('ensureAgregadoVehicles:', e);
        }
    },

    /** Frota própria (não implemento) + placas de agregados ativos. */
    async getVehiclesForFuel(companyId: string) {
        if (!companyId) return [];
        await this.ensureAgregadoVehicles(companyId);
        const [{ data, error }, { data: agregados }] = await Promise.all([
            supabase.from('vehicles').select('*').eq('company_id', companyId),
            supabase.from('agregados').select('id, status, vehicle_plate').eq('company_id', companyId),
        ]);
        if (error) throw error;
        const activeIds = new Set(
            (agregados || [])
                .filter((a: any) => a.status !== 'inactive' && String(a.vehicle_plate || '').trim())
                .map((a: any) => a.id)
        );
        return (data || []).filter((v: any) =>
            v.category !== 'implemento' && (!v.agregado_id || activeIds.has(v.agregado_id))
        );
    },
    async addVehicle(vehicle: any) {
        if (!vehicle.company_id) throw new Error("ID da empresa não informado.");
        const { id: _id, ...vehicleData } = vehicle;
        const { data, error } = await supabase
            .from('vehicles')
            .insert([vehicleData])
            .select()
            .single();
        if (error) throw error;
        return data;
    },
    async updateVehicle(id: string, updates: any) {
        const { data, error = null } = await supabase
            .from('vehicles')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },
    /**
     * Sobe o hodômetro oficial do veículo somente se o valor for maior que o atual.
     * Preferir recalculateVehicleKm após editar/apagar lançamentos.
     */
    async bumpVehicleKm(vehicleId: string, km: number | string | null | undefined) {
        const n = Number(km);
        if (!vehicleId || !Number.isFinite(n) || n <= 0) return;
        const { data: vehicle, error: readErr } = await supabase
            .from('vehicles')
            .select('current_km')
            .eq('id', vehicleId)
            .maybeSingle();
        if (readErr) throw readErr;
        if (!vehicle) return;
        const current = Number(vehicle.current_km) || 0;
        if (n <= current) return;
        const { error } = await supabase
            .from('vehicles')
            .update({ current_km: n })
            .eq('id', vehicleId);
        if (error) throw error;
    },
    /**
     * Recalcula vehicles.current_km = maior KM entre:
     * initial_km, abastecimentos (odometer), viagens (start/end), manutenções (km).
     * Corrige typo alto: editar/apagar o lançamento errado baixa o hodômetro oficial.
     */
    async recalculateVehicleKm(vehicleId: string) {
        if (!vehicleId) return;
        const { data: vehicle, error: vErr } = await supabase
            .from('vehicles')
            .select('initial_km')
            .eq('id', vehicleId)
            .maybeSingle();
        if (vErr) throw vErr;
        if (!vehicle) return;

        const [fuelRes, tripStartRes, tripEndRes, maintRes] = await Promise.all([
            supabase
                .from('fuel_records')
                .select('odometer')
                .eq('vehicle_id', vehicleId)
                .not('odometer', 'is', null)
                .order('odometer', { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase
                .from('trips')
                .select('start_km')
                .eq('vehicle_id', vehicleId)
                .not('start_km', 'is', null)
                .order('start_km', { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase
                .from('trips')
                .select('end_km')
                .eq('vehicle_id', vehicleId)
                .not('end_km', 'is', null)
                .order('end_km', { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase
                .from('maintenance')
                .select('km')
                .eq('vehicle_id', vehicleId)
                .not('km', 'is', null)
                .order('km', { ascending: false })
                .limit(1)
                .maybeSingle(),
        ]);

        for (const r of [fuelRes, tripStartRes, tripEndRes, maintRes]) {
            if (r.error) throw r.error;
        }

        const maxKm = Math.max(
            Number(vehicle.initial_km) || 0,
            Number(fuelRes.data?.odometer) || 0,
            Number(tripStartRes.data?.start_km) || 0,
            Number(tripEndRes.data?.end_km) || 0,
            Number(maintRes.data?.km) || 0,
        );

        const { error } = await supabase
            .from('vehicles')
            .update({ current_km: maxKm })
            .eq('id', vehicleId);
        if (error) throw error;
    },
    /** Recalcula um ou mais veículos (ex.: troca de veículo no lançamento). */
    async recalculateVehicleKmMany(vehicleIds: Array<string | null | undefined>) {
        const unique = [...new Set(vehicleIds.filter((id): id is string => !!id))];
        for (const id of unique) {
            await this.recalculateVehicleKm(id);
        }
    },
    async deleteVehicle(id: string) {
        const { error } = await supabase
            .from('vehicles')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },
    /**
     * Engata/desengata um implemento no cavalo (engate persistente).
     * Garante exclusividade: remove o implemento de qualquer outro cavalo antes.
     * implementId = null → desacoplar.
     */
    async coupleImplement(companyId: string, vehicleId: string, implementId: string | null) {
        if (implementId) {
            await supabase
                .from('vehicles')
                .update({ current_implement_id: null })
                .eq('company_id', companyId)
                .eq('current_implement_id', implementId)
                .neq('id', vehicleId);
        }
        const { error } = await supabase
            .from('vehicles')
            .update({ current_implement_id: implementId })
            .eq('id', vehicleId);
        if (error) throw error;
    },
    async getDrivers(companyId: string) {
        if (!companyId) return [];
        const { data, error } = await supabase
            .from('drivers')
            .select('*')
            .eq('company_id', companyId);
        if (error) throw error;
        return data;
    },
    async addDriver(driver: any) {
        if (!driver.company_id) throw new Error("ID da empresa não informado.");
        const { id: _id, ...driverData } = driver;
        const { data, error } = await supabase
            .from('drivers')
            .insert([driverData])
            .select()
            .single();
        if (error) throw error;
        return data;
    },
    async updateDriver(id: string, updates: any) {
        const { data, error } = await supabase
            .from('drivers')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },
    async deleteDriver(id: string) {
        const { error } = await supabase
            .from('drivers')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },
    async getDriverByEmail(email: string) {
        const { data, error } = await supabase
            .from('drivers')
            .select('*, vehicle:vehicles(*)')
            .eq('email', email)
            .single();
        if (error) throw error;
        return data;
    }
};

export const tripService = {
    async getTrips(companyId: string, startDate?: string, endDate?: string): Promise<any[]> {
        const applyFilters = (q: any) => {
            q = q.eq('company_id', companyId).order('created_at', { ascending: false });
            if (startDate) q = q.gte('created_at', saoPauloStart(startDate));
            if (endDate)   q = q.lt('created_at', saoPauloEndExclusive(endDate));
            return q;
        };

        // Tenta com join de agregados; se falhar (tabela ainda não existe), busca sem
        const { data, error } = await applyFilters(
            supabase.from('trips').select('*, vehicle:vehicles!trips_vehicle_id_fkey(plate), driver:drivers(name), agregado:agregados(name,vehicle_plate)')
        );
        if (!error) return (data as any[]) ?? [];

        const { data: fallback, error: err2 } = await applyFilters(
            supabase.from('trips').select('*, vehicle:vehicles!trips_vehicle_id_fkey(plate), driver:drivers(name)')
        );
        if (err2) throw err2;
        return (fallback as any[]) ?? [];
    },
    /** Últimas N viagens do período (Dashboard) — evita carregar o mês inteiro só para slice(0,5). */
    async getRecentTrips(companyId: string, startDate?: string, endDate?: string, limit = 5): Promise<any[]> {
        let q = supabase
            .from('trips')
            .select('id, origin, destination, cargo_description, gross_value, status, created_at, vehicle_id, vehicle:vehicles!trips_vehicle_id_fkey(plate), driver:drivers(name)')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (startDate) q = q.gte('created_at', saoPauloStart(startDate));
        if (endDate) q = q.lt('created_at', saoPauloEndExclusive(endDate));
        const { data, error } = await q;
        if (error) throw error;
        return (data as any[]) ?? [];
    },
    /** Viagens ainda não pagas (acerto) — sem filtro de data, para não esconder pendências antigas. */
    async getUnsettledTrips(companyId: string): Promise<any[]> {
        const apply = (q: any) => q.eq('company_id', companyId).neq('status', 'paid').order('created_at', { ascending: false });
        const { data, error } = await apply(
            supabase.from('trips').select('*, vehicle:vehicles!trips_vehicle_id_fkey(plate), driver:drivers(name), agregado:agregados(name,vehicle_plate)')
        );
        if (!error) return (data as any[]) ?? [];
        const { data: fallback, error: err2 } = await apply(
            supabase.from('trips').select('*, vehicle:vehicles!trips_vehicle_id_fkey(plate), driver:drivers(name)')
        );
        if (err2) throw err2;
        return (fallback as any[]) ?? [];
    },
    /** Cidades usadas em viagens (frequência desc) para autocomplete. */
    async getCitySuggestions(companyId: string, limit = 80): Promise<string[]> {
        const { data, error } = await supabase
            .from('trips')
            .select('origin, destination')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .limit(400);
        if (error) throw error;
        const counts: Record<string, number> = {};
        for (const t of data || []) {
            for (const raw of [t.origin, t.destination]) {
                const city = String(raw || '').trim();
                if (!city) continue;
                counts[city] = (counts[city] || 0) + 1;
            }
        }
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
            .slice(0, limit)
            .map(([city]) => city);
    },
    /** Pares origem→destino mais usados (atalho de trecho recente). */
    async getRecentRoutePairs(companyId: string, limit = 25): Promise<{ origin: string; destination: string; count: number }[]> {
        const { data, error } = await supabase
            .from('trips')
            .select('origin, destination')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .limit(300);
        if (error) throw error;
        const map: Record<string, { origin: string; destination: string; count: number }> = {};
        for (const t of data || []) {
            const origin = String(t.origin || '').trim();
            const destination = String(t.destination || '').trim();
            if (!origin || !destination) continue;
            const key = `${origin.toLowerCase()}→${destination.toLowerCase()}`;
            if (!map[key]) map[key] = { origin, destination, count: 0 };
            map[key].count += 1;
        }
        return Object.values(map)
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    },
    async updateTripStatus(tripId: string, status: string) {
        const { data, error } = await supabase
            .from('trips')
            .update({ status })
            .eq('id', tripId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },
    async checkConflicts(driverId: string | null, vehicleId: string | null, excludeTripId?: string, implementId?: string | null): Promise<{ driverBusy: boolean; vehicleBusy: boolean; implementBusy: boolean; driverTrip: any; vehicleTrip: any; implementTrip: any }> {
        const ACTIVE = ['pending', 'in_transit'];
        const idToExclude = excludeTripId || '00000000-0000-0000-0000-000000000000';

        const [driverRes, vehicleRes, implementRes] = await Promise.all([
            driverId
                ? supabase.from('trips').select('id, origin, destination, created_at, vehicle:vehicles!trips_vehicle_id_fkey(plate)').eq('driver_id', driverId).in('status', ACTIVE).neq('id', idToExclude).limit(1).maybeSingle()
                : Promise.resolve({ data: null, error: null }),
            vehicleId
                ? supabase.from('trips').select('id, origin, destination, created_at, driver:drivers(name)').eq('vehicle_id', vehicleId).in('status', ACTIVE).neq('id', idToExclude).limit(1).maybeSingle()
                : Promise.resolve({ data: null, error: null }),
            implementId
                ? supabase.from('trips').select('id, origin, destination, created_at, vehicle:vehicles!trips_vehicle_id_fkey(plate)').eq('implement_id', implementId).in('status', ACTIVE).neq('id', idToExclude).limit(1).maybeSingle()
                : Promise.resolve({ data: null, error: null }),
        ]);
        return {
            driverBusy: !!driverRes.data,
            vehicleBusy: !!vehicleRes.data,
            implementBusy: !!implementRes.data,
            implementTrip: implementRes.data,
            driverTrip: driverRes.data,
            vehicleTrip: vehicleRes.data,
        };
    },

    async addTrip(trip: any) {
        const { id: _id, ...tripData } = trip; // nunca passar id no insert
        const { data, error } = await supabase
            .from('trips')
            .insert([tripData])
            .select()
            .single();
        if (error) throw error;
        if (tripData.vehicle_id) {
            try { await fleetService.recalculateVehicleKm(tripData.vehicle_id); } catch (e) { console.warn('recalculateVehicleKm:', e); }
        }
        return data;
    },
    async settleTrips(tripIds: string[]) {
        const { data, error } = await supabase
            .from('trips')
            .update({ status: 'paid' })
            .in('id', tripIds)
            .select();
        if (error) throw error;
        return data;
    },
    async getActiveTrip(driverId: string) {
        const { data, error } = await supabase
            .from('trips')
            .select('*, vehicle:vehicles!trips_vehicle_id_fkey(plate, current_km)')
            .eq('driver_id', driverId)
            .eq('status', 'in_transit')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data;
    },
    async finishTrip(tripId: string) {
        const { data, error } = await supabase
            .from('trips')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', tripId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },
    async updateTrip(id: string, updates: any) {
        const { data: before } = await supabase
            .from('trips')
            .select('vehicle_id')
            .eq('id', id)
            .maybeSingle();
        const { data, error } = await supabase
            .from('trips')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        try {
            await fleetService.recalculateVehicleKmMany([before?.vehicle_id, data?.vehicle_id, updates?.vehicle_id]);
        } catch (e) {
            console.warn('recalculateVehicleKm:', e);
        }
        return data;
    },
    /**
     * Exclui a viagem do sistema inteiro:
     * - remove/atualiza settlements (trips_ids)
     * - reabre vales se o acerto ficar vazio
     * - apaga financial_transactions e accounts_receivable com trip_id
     * - apaga accounts_payable de agregado com "Viagem ID: …"
     * - por fim apaga a linha em trips
     */
    async deleteTrip(id: string) {
        const { data: tripBefore } = await supabase
            .from('trips')
            .select('vehicle_id')
            .eq('id', id)
            .maybeSingle();

        // 1) Ajustar/remover fechamentos de acerto que referenciam esta viagem
        const { data: settlements, error: sErr } = await supabase
            .from('settlements')
            .select('*')
            .contains('trips_ids', [id]);
        if (sErr) throw sErr;

        for (const settlement of settlements || []) {
            const remaining: string[] = (settlement.trips_ids || []).filter((tid: string) => tid !== id);
            if (remaining.length === 0) {
                const advIds: string[] = settlement.advances_ids || [];
                if (advIds.length > 0) {
                    await supabase
                        .from('driver_advances')
                        .update({ status: 'pending' })
                        .in('id', advIds)
                        .eq('status', 'settled');
                }
                const { error: delSetErr } = await supabase
                    .from('settlements')
                    .delete()
                    .eq('id', settlement.id);
                if (delSetErr) throw delSetErr;
            } else {
                const { error: updErr } = await supabase
                    .from('settlements')
                    .update({ trips_ids: remaining })
                    .eq('id', settlement.id);
                if (updErr) throw updErr;
                // Recalcula totais com as viagens restantes (ainda existem no banco)
                await settlementService.recalculateSettlementForTrip(remaining[0]);
            }
        }

        // 2) Lançamentos financeiros e contas a receber vinculados
        const { error: ftErr } = await supabase
            .from('financial_transactions')
            .delete()
            .eq('trip_id', id);
        if (ftErr) throw ftErr;

        const { error: arErr } = await supabase
            .from('accounts_receivable')
            .delete()
            .eq('trip_id', id);
        if (arErr) throw arErr;

        // 3) Contas a pagar de agregado (notes: "Viagem ID: <uuid>")
        const { data: payables } = await supabase
            .from('accounts_payable')
            .select('id, notes')
            .ilike('notes', `%Viagem ID: ${id}%`);
        const payableIds = (payables || [])
            .filter((p: any) => String(p.notes || '').includes(`Viagem ID: ${id}`))
            .map((p: any) => p.id);
        if (payableIds.length > 0) {
            const { error: apErr } = await supabase
                .from('accounts_payable')
                .delete()
                .in('id', payableIds);
            if (apErr) throw apErr;
        }

        // 4) Viagem
        const { error } = await supabase
            .from('trips')
            .delete()
            .eq('id', id);
        if (error) throw error;

        if (tripBefore?.vehicle_id) {
            try { await fleetService.recalculateVehicleKm(tripBefore.vehicle_id); } catch (e) { console.warn('recalculateVehicleKm:', e); }
        }
    }
};

export const settlementService = {
    async getAdvances(companyId: string, status: string = 'pending') {
        let query = supabase
            .from('driver_advances')
            .select('*, driver:drivers(name)')
            .eq('company_id', companyId)
            .order('date', { ascending: false });
        
        if (status !== 'all') {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },
    async addAdvance(advance: any) {
        const { data, error } = await supabase
            .from('driver_advances')
            .insert([advance])
            .select()
            .single();
        if (error) throw error;
        return data;
    },
    async updateAdvanceStatus(advanceId: string, status: string) {
        const { error } = await supabase
            .from('driver_advances')
            .update({ status })
            .eq('id', advanceId);
        if (error) throw error;
    },
    async updateAdvance(id: string, updates: any) {
        const { data, error } = await supabase
            .from('driver_advances')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },
    async deleteAdvance(id: string) {
        const { error } = await supabase
            .from('driver_advances')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },
    /**
     * Desfaz o pagamento de um frete (Pago → Pendente):
     * - remove a viagem do settlement (ou apaga o settlement se ficar vazio)
     * - reabre vales liquidados nesse acerto quando o fechamento inteiro some
     * - volta o status da viagem para pending
     * Dashboard/financeiro/produção passam a refletir sem o pagamento (status + vales).
     */
    async revertTripPayment(tripId: string) {
        if (!tripId) throw new Error('ID da viagem não informado.');

        const { data: trip, error: tripErr } = await supabase
            .from('trips')
            .select('id, status, driver_type')
            .eq('id', tripId)
            .maybeSingle();
        if (tripErr) throw tripErr;
        if (!trip) throw new Error('Viagem não encontrada.');
        if (String(trip.status || '').toLowerCase() !== 'paid') {
            throw new Error('Somente fretes com status Pago podem voltar para Pendente.');
        }

        const { data: settlements, error: sErr } = await supabase
            .from('settlements')
            .select('*')
            .contains('trips_ids', [tripId]);
        if (sErr) throw sErr;

        for (const settlement of settlements || []) {
            const remaining: string[] = (settlement.trips_ids || []).filter((tid: string) => tid !== tripId);

            if (remaining.length === 0) {
                const advIds: string[] = settlement.advances_ids || [];
                if (advIds.length > 0) {
                    const { error: advErr } = await supabase
                        .from('driver_advances')
                        .update({ status: 'pending' })
                        .in('id', advIds)
                        .in('status', ['settled', 'paid']);
                    if (advErr) throw advErr;
                }
                const { error: delErr } = await supabase
                    .from('settlements')
                    .delete()
                    .eq('id', settlement.id);
                if (delErr) throw delErr;
            } else {
                // Proporção simples dos descontos de vale por viagem do lote
                const oldCount = (settlement.trips_ids || []).length || 1;
                const ratio = remaining.length / oldCount;
                const totalAdvances = round2((Number(settlement.total_advances_applied) || 0) * ratio);
                const totalTripDiscounts = round2((Number(settlement.total_trip_discounts) || 0) * ratio);

                const { error: updErr } = await supabase
                    .from('settlements')
                    .update({
                        trips_ids: remaining,
                        total_advances_applied: totalAdvances,
                        total_trip_discounts: totalTripDiscounts,
                    })
                    .eq('id', settlement.id);
                if (updErr) throw updErr;
                await this.recalculateSettlementForTrip(remaining[0]);
            }
        }

        const { error: statusErr } = await supabase
            .from('trips')
            .update({ status: 'pending', updated_at: new Date().toISOString() })
            .eq('id', tripId);
        if (statusErr) throw statusErr;
    },

    async createSettlement(settlement: any) {
        // Impede duplicata: verifica se algum trip_id já está em outro settlement
        if (settlement.trips_ids?.length) {
            const { data: existing } = await supabase
                .from('settlements')
                .select('id, trips_ids')
                .contains('trips_ids', settlement.trips_ids.slice(0, 1));
            if (existing && existing.length > 0) {
                // Remove trips já liquidadas
                const alreadySettled = new Set(existing.flatMap((s: any) => s.trips_ids));
                settlement = {
                    ...settlement,
                    trips_ids: settlement.trips_ids.filter((id: string) => !alreadySettled.has(id)),
                };
                if (settlement.trips_ids.length === 0) throw new Error('Estas viagens já foram liquidadas anteriormente.');
            }
        }
        const { data, error } = await supabase
            .from('settlements')
            .insert([settlement])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // Recalcula o settlement vinculado a uma trip após edição
    async recalculateSettlementForTrip(tripId: string) {
        // Busca settlement que contém esta trip
        const { data: settlements, error: sErr } = await supabase
            .from('settlements')
            .select('*')
            .contains('trips_ids', [tripId]);
        if (sErr || !settlements || settlements.length === 0) return;

        for (const settlement of settlements) {
            const tripIds: string[] = settlement.trips_ids || [];
            if (tripIds.length === 0) continue;

            // Busca todas as trips do settlement
            const { data: trips, error: tErr } = await supabase
                .from('trips')
                .select('company_id, gross_value, commission_rate, tax_rate, icms_value, tolls_value, insurance_value, estimated_cost, loading_cost, unloading_cost')
                .in('id', tripIds);
            if (tErr || !trips) continue;

            const companyId = trips[0]?.company_id || settlement.company_id;
            let baseMode = normalizeCommissionBase('net_tax');
            if (companyId) {
                try {
                    const s = await settingsService.getSettings(companyId);
                    baseMode = normalizeCommissionBase(s?.commission_base);
                } catch { /* default net_tax */ }
            }

            const totalGross = trips.reduce((acc, t) => acc + (Number(t.gross_value) || 0), 0);
            const totalCommission = trips.reduce((acc, t) => {
                return acc + calcTripCommission(t, baseMode, 12).commission;
            }, 0);

            const netPaid = round2(Math.max(0, totalCommission - (Number(settlement.total_advances_applied) || 0) - (Number(settlement.total_trip_discounts) || 0)));

            await supabase
                .from('settlements')
                .update({ total_gross: totalGross, net_paid: netPaid })
                .eq('id', settlement.id);
        }
    },

    /**
     * Remove settlements cujos trips_ids não existem mais (órfãos de exclusões antigas)
     * e recalcula os que ainda têm viagens válidas.
     */
    async purgeOrphanSettlements(companyId?: string) {
        let query = supabase.from('settlements').select('id, company_id, trips_ids, total_advances_applied, total_trip_discounts');
        if (companyId) query = query.eq('company_id', companyId);
        const { data: settlements, error } = await query;
        if (error) throw error;
        if (!settlements?.length) return { deleted: 0, updated: 0 };

        let deleted = 0;
        let updated = 0;

        for (const settlement of settlements) {
            const tripIds: string[] = settlement.trips_ids || [];
            if (tripIds.length === 0) {
                await supabase.from('settlements').delete().eq('id', settlement.id);
                deleted += 1;
                continue;
            }

            const { data: existingTrips } = await supabase
                .from('trips')
                .select('id, company_id, gross_value, commission_rate, tax_rate, icms_value, tolls_value, insurance_value, estimated_cost, loading_cost, unloading_cost')
                .in('id', tripIds);

            const alive = existingTrips || [];
            if (alive.length === 0) {
                await supabase.from('settlements').delete().eq('id', settlement.id);
                deleted += 1;
                continue;
            }

            const aliveIds = alive.map((t: any) => t.id);
            const hadGhosts = aliveIds.length !== tripIds.length;

            let baseMode = normalizeCommissionBase('net_tax');
            const cid = alive[0]?.company_id || settlement.company_id;
            if (cid) {
                try {
                    const s = await settingsService.getSettings(cid);
                    baseMode = normalizeCommissionBase(s?.commission_base);
                } catch { /* default */ }
            }

            const round2 = (n: number) => Math.round(n * 100) / 100;
            const totalGross = alive.reduce((acc: number, t: any) => acc + (Number(t.gross_value) || 0), 0);
            const totalCommission = alive.reduce((acc: number, t: any) => {
                return acc + calcTripCommission(t, baseMode, 12).commission;
            }, 0);
            const netPaid = round2(Math.max(0, totalCommission - (Number(settlement.total_advances_applied) || 0) - (Number(settlement.total_trip_discounts) || 0)));

            await supabase
                .from('settlements')
                .update({ trips_ids: aliveIds, total_gross: totalGross, net_paid: netPaid })
                .eq('id', settlement.id);
            if (hadGhosts) updated += 1;
        }

        return { deleted, updated };
    }
};

export const financeService = {
    async getKpis(companyId: string, startDate?: string, endDate?: string) {
        let tripQuery = supabase
            .from('trips')
            .select('gross_value, status, tolls_value, insurance_value, icms_value, estimated_cost, loading_cost, unloading_cost, commission_rate, tax_rate, driver_type, agregado_value')
            .eq('company_id', companyId);

        let fuelQuery = supabase
            .from('fuel_records')
            .select('total_value, arla_value')
            .eq('company_id', companyId);

        let maintenanceQuery = supabase
            .from('maintenance')
            .select('cost')
            .eq('company_id', companyId);

        let vehicleQuery = supabase
            .from('vehicles')
            .select('insurance_value')
            .eq('company_id', companyId);

        if (startDate && endDate) {
            const maint = utcCalendarRange(startDate, endDate);
            maintenanceQuery = maintenanceQuery.gte('date', maint.gte).lt('date', maint.lt);
        } else if (startDate) {
            maintenanceQuery = maintenanceQuery.gte('date', utcCalendarRange(startDate, startDate).gte);
        } else if (endDate) {
            maintenanceQuery = maintenanceQuery.lt('date', utcCalendarRange(endDate, endDate).lt);
        }

        if (startDate) {
            tripQuery = tripQuery.gte('created_at', saoPauloStart(startDate));
            fuelQuery = fuelQuery.gte('created_at', saoPauloStart(startDate));
        }
        if (endDate) {
            tripQuery = tripQuery.lt('created_at', saoPauloEndExclusive(endDate));
            fuelQuery = fuelQuery.lt('created_at', saoPauloEndExclusive(endDate));
        }

        const [
            { data: trips, error: tError }, 
            { data: fuel, error: fError }, 
            { data: maintenance, error: mError },
            { data: vehicles, error: vError }
        ] = await Promise.all([
            tripQuery,
            fuelQuery,
            maintenanceQuery,
            vehicleQuery
        ]);

        if (tError || fError || mError || vError) throw tError || fError || mError || vError;

        const validStatuses = ['completed', 'paid'];
        
        const grossRevenue = trips?.filter(t => validStatuses.includes(t.status)).reduce((acc, trip) => acc + (Number(trip.gross_value) || 0), 0) || 0;
        const expectedGrossRevenue = trips?.filter(t => !validStatuses.includes(t.status)).reduce((acc, trip) => acc + (Number(trip.gross_value) || 0), 0) || 0;
        
        const fuelExpenses = fuel?.reduce((acc, record) => acc + (Number(record.total_value) || 0), 0) || 0;
        const arlaExpenses = fuel?.reduce((acc, record) => acc + (Number((record as any).arla_value) || 0), 0) || 0;
        const maintenanceExpenses = maintenance?.reduce((acc, m) => acc + (Number((m as any).cost) || 0), 0) || 0;
        
        // Custos de Viagem (Pedágio, Seguro, ICMS, Carregamento, Descarga)
        const tripTolls = trips?.reduce((acc, trip) => acc + (Number((trip as any).tolls_value) || 0), 0) || 0;
        const tripInsurance = trips?.reduce((acc, trip) => acc + (Number((trip as any).insurance_value) || 0), 0) || 0;
        const tripIcms = trips?.reduce((acc, trip) => acc + (Number((trip as any).icms_value) || 0), 0) || 0;
        const tripLoading = trips?.reduce((acc, trip) => acc + (Number((trip as any).loading_cost) || 0), 0) || 0;
        const tripUnloading = trips?.reduce((acc, trip) => acc + (Number((trip as any).unloading_cost) || 0), 0) || 0;
        
        // Custos Fixos de Veículo (Seguro fixo - escalonado pelo período se necessário, mas aqui somaremos o total cadastrado)
        const fixedInsurance = vehicles?.reduce((acc, vehicle) => acc + (Number((vehicle as any).insurance_value) || 0), 0) || 0;

        let commissionBase = normalizeCommissionBase('net_tax');
        try {
            const s = await settingsService.getSettings(companyId);
            commissionBase = normalizeCommissionBase(s?.commission_base);
        } catch { /* default */ }

        // Comissão dos motoristas (base configurável por empresa)
        const totalCommission = trips?.reduce((acc, t) => {
            return acc + calcTripCommission(t, commissionBase).commission;
        }, 0) || 0;

        // Impostos (tax_rate % sobre gross_value por viagem)
        const totalTax = trips?.reduce((acc, t) => {
            const gross = Number(t.gross_value) || 0;
            const rate = Number((t as any).tax_rate) || 0;
            return acc + (gross * rate / 100);
        }, 0) || 0;

        // Custo de agregados (valor repassado ao terceiro por viagem de agregado)
        const totalAgregado = trips?.reduce((acc, t) => {
            if ((t as any).driver_type !== 'agregado') return acc;
            return acc + (Number((t as any).agregado_value) || 0);
        }, 0) || 0;

        const totalExpenses = fuelExpenses + arlaExpenses + maintenanceExpenses + tripTolls + tripInsurance + tripIcms + tripLoading + tripUnloading + fixedInsurance + totalCommission + totalTax + totalAgregado;

        return {
            grossRevenue,
            expectedGrossRevenue,
            fuelExpenses,
            arlaExpenses,
            maintenanceExpenses,
            tripTolls,
            tripInsurance,
            tripIcms,
            tripLoading,
            tripUnloading,
            fixedInsurance,
            totalCommission,
            totalTax,
            totalAgregado,
            totalExpenses,
            netRevenue: (grossRevenue + expectedGrossRevenue) - totalExpenses,
            expectedNetRevenue: expectedGrossRevenue
        };
    },
    async getMonthlyFinancials(companyId: string) {
        const today = new Date();
        const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString();

        const { data: trips, error: tError } = await supabase
            .from('trips')
            .select('gross_value, tolls_value, insurance_value, icms_value, loading_cost, unloading_cost, created_at')
            .eq('company_id', companyId)
            .gte('created_at', sixMonthsAgo);

        const { data: fuel, error: fError } = await supabase
            .from('fuel_records')
            .select('total_value, arla_value, created_at')
            .eq('company_id', companyId)
            .gte('created_at', sixMonthsAgo);

        const { data: maintenance, error: mError } = await supabase
            .from('maintenance')
            .select('cost, date')
            .eq('company_id', companyId)
            .gte('date', sixMonthsAgo);

        if (tError || fError || mError) throw tError || fError || mError;

        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const result: Record<string, { name: string, revenue: number, expenses: number }> = {};

        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            result[key] = { name: months[d.getMonth()], revenue: 0, expenses: 0 };
        }

        trips?.forEach(t => {
            const d = new Date(t.created_at);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (result[key]) {
                result[key].revenue += Number(t.gross_value) || 0;
                result[key].expenses += (Number((t as any).tolls_value) || 0)
                    + (Number((t as any).insurance_value) || 0)
                    + (Number((t as any).icms_value) || 0)
                    + (Number((t as any).loading_cost) || 0)
                    + (Number((t as any).unloading_cost) || 0);
            }
        });

        fuel?.forEach(f => {
            const d = new Date(f.created_at);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (result[key]) result[key].expenses += (Number(f.total_value) || 0) + (Number((f as any).arla_value) || 0);
        });

        maintenance?.forEach(m => {
            const d = new Date(m.date);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (result[key]) result[key].expenses += Number((m as any).cost) || 0;
        });

        return Object.values(result);
    }
};

export const maintenanceService = {
    async getMaintenanceHistory(companyId: string, startDate?: string, endDate?: string) {
        let query = supabase
            .from('maintenance')
            .select('*, vehicle:vehicles(plate, current_km)')
            .eq('company_id', companyId)
            .order('date', { ascending: false });

        if (startDate && endDate) {
            const range = utcCalendarRange(startDate, endDate);
            query = query.gte('date', range.gte).lt('date', range.lt);
        } else if (startDate) {
            query = query.gte('date', utcCalendarRange(startDate, startDate).gte);
        } else if (endDate) {
            query = query.lt('date', utcCalendarRange(endDate, endDate).lt);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },
    async addMaintenance(maintenance: any) {
        const { id: _id, vehicle: _vehicle, ...maintenanceData } = maintenance;
        // Converte strings vazias em null para colunas de tipo date/integer
        if (maintenanceData.next_maintenance_date === '') maintenanceData.next_maintenance_date = null;
        if (maintenanceData.maintenance_interval_months === '' || maintenanceData.maintenance_interval_months === 0) maintenanceData.maintenance_interval_months = null;
        const { data, error } = await supabase
            .from('maintenance')
            .insert([maintenanceData])
            .select()
            .single();
        if (error) throw error;

        // Atualiza hodômetro oficial a partir de todos os lançamentos
        const kmDone = Number(maintenance.km || maintenance.current_km) || 0;
        if (maintenance.vehicle_id) {
            try { await fleetService.recalculateVehicleKm(maintenance.vehicle_id); } catch (e) { console.warn('recalculateVehicleKm:', e); }

            // Sincroniza campos de histórico do veículo para manter alertas corretos
            const vehicleUpdate: Record<string, any> = {};
            if (kmDone > 0) {
                if (maintenance.type === 'preventive') {
                    if (maintenance.preventive_type === 'oleo') vehicleUpdate.last_oil_change_km = kmDone;
                    if (maintenance.preventive_type === 'filtros') vehicleUpdate.last_filter_change_km = kmDone;
                    if (maintenance.preventive_type === 'pneu') vehicleUpdate.last_tyre_change_km = kmDone;
                }
                if (maintenance.type === 'oil') vehicleUpdate.last_oil_change_km = kmDone;
                if (maintenance.type === 'tyres') vehicleUpdate.last_tyre_change_km = kmDone;
            }

            if (Object.keys(vehicleUpdate).length > 0) {
                await supabase
                    .from('vehicles')
                    .update(vehicleUpdate)
                    .eq('id', maintenance.vehicle_id);
            }
        }
        return data;
    },
    async updateMaintenance(id: string, updates: any) {
        const { vehicle: _v, id: _id, ...cleanUpdates } = updates;
        // Converte strings vazias em null para colunas de tipo date/integer
        if (cleanUpdates.next_maintenance_date === '') cleanUpdates.next_maintenance_date = null;
        if (cleanUpdates.maintenance_interval_months === '' || cleanUpdates.maintenance_interval_months === 0) cleanUpdates.maintenance_interval_months = null;
        const { data: before } = await supabase
            .from('maintenance')
            .select('vehicle_id')
            .eq('id', id)
            .maybeSingle();
        const { data, error } = await supabase
            .from('maintenance')
            .update(cleanUpdates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;

        const vehicleId = data?.vehicle_id || updates.vehicle_id || before?.vehicle_id;
        const kmDone = Number(updates.km || updates.current_km || data?.km) || 0;
        try {
            await fleetService.recalculateVehicleKmMany([before?.vehicle_id, vehicleId]);
        } catch (e) {
            console.warn('recalculateVehicleKm:', e);
        }
        if (kmDone > 0 && vehicleId) {
            const vehicleUpdate: Record<string, any> = {};
            if (updates.type === 'preventive') {
                if (updates.preventive_type === 'oleo') vehicleUpdate.last_oil_change_km = kmDone;
                if (updates.preventive_type === 'filtros') vehicleUpdate.last_filter_change_km = kmDone;
                if (updates.preventive_type === 'pneu') vehicleUpdate.last_tyre_change_km = kmDone;
            }
            if (updates.type === 'oil') vehicleUpdate.last_oil_change_km = kmDone;
            if (updates.type === 'tyres') vehicleUpdate.last_tyre_change_km = kmDone;
            if (Object.keys(vehicleUpdate).length > 0) {
                await supabase.from('vehicles').update(vehicleUpdate).eq('id', vehicleId);
            }
        }
        return data;
    },
    async deleteMaintenance(id: string) {
        const { data: before } = await supabase
            .from('maintenance')
            .select('vehicle_id')
            .eq('id', id)
            .maybeSingle();
        const { error } = await supabase
            .from('maintenance')
            .delete()
            .eq('id', id);
        if (error) throw error;
        if (before?.vehicle_id) {
            try { await fleetService.recalculateVehicleKm(before.vehicle_id); } catch (e) { console.warn('recalculateVehicleKm:', e); }
        }
    }
};

export const preventiveTypesService = {
    async getTypes(companyId: string) {
        const { data, error } = await supabase
            .from('preventive_types')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
    },
    async addType(companyId: string, type: { name: string; value: string; control_type: string; default_interval: number }) {
        const { data, error } = await supabase
            .from('preventive_types')
            .insert([{ company_id: companyId, ...type }])
            .select()
            .single();
        if (error) throw error;
        return data;
    },
    async updateType(id: string, updates: { name: string; control_type: string; default_interval: number }) {
        const { data, error } = await supabase
            .from('preventive_types')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },
    async deleteType(id: string) {
        const { error } = await supabase
            .from('preventive_types')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },
    async seedDefaults(companyId: string) {
        const defaults = [
            { name: 'Troca de Óleo', value: 'oleo', control_type: 'km', default_interval: 10000 },
            { name: 'Filtros', value: 'filtros', control_type: 'km', default_interval: 10000 },
            { name: 'Freios', value: 'freios', control_type: 'km', default_interval: 50000 },
            { name: 'Correias', value: 'correias', control_type: 'km', default_interval: 80000 },
            { name: 'Revisão Geral', value: 'revisao_geral', control_type: 'km', default_interval: 20000 },
            { name: 'Aferição de Tacógrafo', value: 'tacografo', control_type: 'date', default_interval: 24 },
        ];
        const { error } = await supabase
            .from('preventive_types')
            .insert(defaults.map(d => ({ company_id: companyId, ...d })));
        if (error) throw error;
    }
};

export class FuelDupOdometerError extends Error {
    readonly code = 'FUEL_DUP_ODOMETER' as const;
    readonly existing: {
        id: string;
        created_at: string;
        odometer: number | null;
        liters: number | null;
        total_value: number | null;
        vehicle_id: string | null;
        vehicle?: { plate?: string } | null;
    };

    constructor(existing: FuelDupOdometerError['existing']) {
        const plate = existing.vehicle?.plate || '—';
        const day = existing.created_at?.slice(0, 10);
        const dateBr = day
            ? (() => { const [y, m, d] = day.split('-'); return `${d}/${m}/${y}`; })()
            : '—';
        const km = existing.odometer != null ? Number(existing.odometer) : '—';
        super(`Já existe abastecimento para ${plate} em ${dateBr} com hodômetro ${km} km.`);
        this.name = 'FuelDupOdometerError';
        this.existing = existing;
    }
}

export function isFuelDupOdometerError(e: unknown): e is FuelDupOdometerError {
    return !!e && typeof e === 'object' && (e as any).code === 'FUEL_DUP_ODOMETER';
}

const FUEL_DUP_ODOMETER_MSG =
    'Já existe um abastecimento deste veículo com este hodômetro. Abra o lançamento anterior para editar, ou informe outro KM.';

function throwIfFuelOdometerDup(
    error: { code?: string } | null,
    existing: FuelDupOdometerError['existing'] | null
) {
    if (error?.code !== '23505') return;
    if (existing) throw new FuelDupOdometerError(existing);
    throw new Error(FUEL_DUP_ODOMETER_MSG);
}

export const driverService = {
    async addFuelRecord(record: any) {
        // Duplicata de diesel: mesmo veículo + mesmo odômetro.
        // ARLA puro (sem litros de diesel) pode repetir o hodômetro.
        const dieselLiters = Number(record.liters) || 0;
        if (dieselLiters > 0 && record.vehicle_id && record.odometer && record.company_id) {
            const { data: dup } = await supabase
                .from('fuel_records')
                .select('id, created_at, odometer, liters, total_value, vehicle_id, vehicle:vehicles(plate)')
                .eq('vehicle_id', record.vehicle_id)
                .eq('odometer', record.odometer)
                .eq('company_id', record.company_id)
                .gt('liters', 0)
                .limit(1)
                .maybeSingle();
            if (dup) throw new FuelDupOdometerError(dup as FuelDupOdometerError['existing']);
        }
        const { data, error } = await supabase
            .from('fuel_records')
            .insert([record])
            .select('*, vehicle:vehicles(plate)')
            .single();
        if (error) {
            let existing: FuelDupOdometerError['existing'] | null = null;
            if (error.code === '23505' && record.vehicle_id && record.odometer && record.company_id) {
                existing = await this.getFuelRecordByVehicleOdometer(
                    record.company_id, record.vehicle_id, record.odometer
                );
            }
            throwIfFuelOdometerDup(error, existing);
            throw error;
        }
        if (record.vehicle_id) {
            try { await fleetService.recalculateVehicleKm(record.vehicle_id); } catch (e) { console.warn('recalculateVehicleKm:', e); }
        }
        return data;
    },

    /** Posto: litros + tipo. O preço do litro é aplicado no banco e não volta na resposta. */
    async registerPostoFuel(input: {
        vehicle_id: string;
        driver_id?: string | null;
        odometer: number;
        liters: number;
        kind: 'diesel' | 'arla';
    }) {
        const { data, error } = await supabase.rpc('posto_register_fuel', {
            p_vehicle_id: input.vehicle_id,
            p_driver_id: input.driver_id || null,
            p_odometer: input.odometer,
            p_liters: input.liters,
            p_kind: input.kind,
        });
        if (error) throw error;
        if (input.vehicle_id) {
            try { await fleetService.recalculateVehicleKm(input.vehicle_id); } catch (e) { console.warn('recalculateVehicleKm:', e); }
        }
        return data;
    },

    async getFuelRecordById(id: string) {
        const { data, error } = await supabase
            .from('fuel_records')
            .select('*, vehicle:vehicles(plate), driver:drivers(name)')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data;
    },
    async getFuelRecordByVehicleOdometer(companyId: string, vehicleId: string, odometer: number) {
        const { data, error } = await supabase
            .from('fuel_records')
            .select('id, created_at, odometer, liters, total_value, vehicle_id, vehicle:vehicles(plate)')
            .eq('company_id', companyId)
            .eq('vehicle_id', vehicleId)
            .eq('odometer', odometer)
            .gt('liters', 0)
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data as FuelDupOdometerError['existing'] | null;
    },
    async getLastFuelRecord(vehicleId: string) {
        const { data, error } = await supabase
            .from('fuel_records')
            .select('*')
            .eq('vehicle_id', vehicleId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data;
    },
    /** Retorna o registro anterior ao excludeId (usado no modal de edição para calcular KM/L) */
    async getPreviousFuelRecord(vehicleId: string, excludeId: string) {
        const { data, error } = await supabase
            .from('fuel_records')
            .select('odometer, created_at')
            .eq('vehicle_id', vehicleId)
            .neq('id', excludeId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data;
    },
    async getFuelRecords(companyId: string, startDate?: string, endDate?: string) {
        let query = supabase
            .from('fuel_records')
            .select('*, vehicle:vehicles(plate), driver:drivers(name)')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (startDate) query = query.gte('created_at', saoPauloStart(startDate));
        if (endDate) query = query.lt('created_at', saoPauloEndExclusive(endDate));

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },
    /** Odômetros leves por veículo (para KM/L sem baixar histórico completo com joins). */
    async getFuelOdometersForVehicles(companyId: string, vehicleIds: string[]) {
        if (!vehicleIds.length) return [] as { id: string; vehicle_id: string; odometer: number; liters: number | null }[];
        const { data, error } = await supabase
            .from('fuel_records')
            .select('id, vehicle_id, odometer, liters, fuel_type')
            .eq('company_id', companyId)
            .in('vehicle_id', vehicleIds)
            .not('odometer', 'is', null)
            .order('odometer', { ascending: true });
        if (error) throw error;
        return data || [];
    },
    async updateFuelRecord(id: string, updates: any) {
        const { data: before } = await supabase
            .from('fuel_records')
            .select('vehicle_id')
            .eq('id', id)
            .maybeSingle();
        const { data, error } = await supabase
            .from('fuel_records')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) {
            const vehicleId = updates?.vehicle_id || before?.vehicle_id;
            const odometer = updates?.odometer;
            const companyId = updates?.company_id;
            let existing: FuelDupOdometerError['existing'] | null = null;
            if (error.code === '23505' && vehicleId && odometer && companyId) {
                existing = await this.getFuelRecordByVehicleOdometer(companyId, vehicleId, odometer);
            }
            throwIfFuelOdometerDup(error, existing);
            throw error;
        }
        try {
            await fleetService.recalculateVehicleKmMany([before?.vehicle_id, data?.vehicle_id, updates?.vehicle_id]);
        } catch (e) {
            console.warn('recalculateVehicleKm:', e);
        }
        return data;
    },
    async deleteFuelRecord(id: string) {
        const { data: before } = await supabase
            .from('fuel_records')
            .select('vehicle_id')
            .eq('id', id)
            .maybeSingle();
        const { error } = await supabase
            .from('fuel_records')
            .delete()
            .eq('id', id);
        if (error) throw error;
        if (before?.vehicle_id) {
            try { await fleetService.recalculateVehicleKm(before.vehicle_id); } catch (e) { console.warn('recalculateVehicleKm:', e); }
        }
    }
};

export const tyreService = {
    async getTyresByVehicle(vehicleId: string) {
        const { data, error } = await supabase
            .from('tyres')
            .select('*')
            .eq('vehicle_id', vehicleId);
        if (error) throw error;
        return data;
    },
    async addTyre(tyre: any) {
        const { data, error } = await supabase
            .from('tyres')
            .insert([tyre])
            .select()
            .single();
        if (error) throw error;
        return data;
    },
    async updateTyre(id: string, updates: any) {
        const { data, error } = await supabase
            .from('tyres')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },
    async getTyreHistory(tyreId: string) {
        const { data, error } = await supabase
            .from('tyre_checks')
            .select('*')
            .eq('tyre_id', tyreId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },
    async addTyreCheck(check: any) {
        const { data, error } = await supabase
            .from('tyre_checks')
            .insert([check])
            .select()
            .single();
        if (error) throw error;
        return data;
    },
    async deleteTyre(id: string) {
        const { error } = await supabase
            .from('tyres')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};

export const settingsService = {
    async getSettings(companyId: string) {
        if (!companyId) return null;
        const { data, error } = await supabase
            .from('settings')
            .select('*')
            .eq('company_id', companyId)
            .maybeSingle();
        if (error) throw error;
        if (!data) return null;
        // Normaliza nomes antigos (commission_rate/tax_rate/modules) → nomes do app
        return {
            ...data,
            default_commission_rate: data.default_commission_rate ?? data.commission_rate ?? 12,
            default_tax_rate: data.default_tax_rate ?? data.tax_rate ?? 6,
            active_modules: data.active_modules ?? data.modules ?? ['portal', 'driver_app', 'monitoring'],
            commission_base: data.commission_base === 'gross' || data.commission_base === 'net_all' || data.commission_base === 'net_tax'
                ? data.commission_base
                : 'net_tax',
        };
    },
    async saveSettings(settings: any) {
        const companyId = settings.company_id;
        if (!companyId) throw new Error('company_id obrigatório');

        const commission = Number(settings.default_commission_rate ?? settings.commission_rate);
        const tax = Number(settings.default_tax_rate ?? settings.tax_rate);
        const modules = settings.active_modules ?? settings.modules ?? null;
        const commissionBase = settings.commission_base === 'gross' || settings.commission_base === 'net_all' || settings.commission_base === 'net_tax'
            ? settings.commission_base
            : 'net_tax';

        // Payload mínimo — só colunas conhecidas (evita 400 por coluna inexistente)
        const base: Record<string, unknown> = {
            company_id: companyId,
            system_name: settings.system_name ?? null,
            logo_url: settings.logo_url || null,
            primary_color: settings.primary_color || '#2563EB',
            commission_base: commissionBase,
        };
        if (!Number.isNaN(commission)) base.default_commission_rate = commission;
        if (!Number.isNaN(tax)) base.default_tax_rate = tax;
        if (modules) base.modules = modules;

        // 1ª tentativa: schema novo (default_* + modules + commission_base)
        let { data, error } = await supabase
            .from('settings')
            .upsert(base, { onConflict: 'company_id' })
            .select()
            .single();

        // Fallback: schema antigo / sem commission_base ainda
        if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.code === '42703')) {
            const legacy: Record<string, unknown> = {
                company_id: companyId,
                system_name: settings.system_name ?? null,
                logo_url: settings.logo_url || null,
                primary_color: settings.primary_color || '#2563EB',
            };
            if (!Number.isNaN(commission)) legacy.commission_rate = commission;
            if (!Number.isNaN(tax)) legacy.tax_rate = tax;
            if (modules) legacy.active_modules = modules;
            // tenta com commission_base; se falhar de novo, sem ela
            legacy.commission_base = commissionBase;

            let retry = await supabase
                .from('settings')
                .upsert(legacy, { onConflict: 'company_id' })
                .select()
                .single();

            if (retry.error && String(retry.error.message || '').includes('commission_base')) {
                delete legacy.commission_base;
                retry = await supabase
                    .from('settings')
                    .upsert(legacy, { onConflict: 'company_id' })
                    .select()
                    .single();
            }
            data = retry.data;
            error = retry.error;
        }

        if (error) throw error;
        return data;
    },
    async getCompanyProfile(companyId: string) {
        if (!companyId) return { company_name: '' };

        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .eq('id', companyId)
            .maybeSingle();

        // Sucesso: retorna a empresa
        if (!error && data) return data;

        // Rede/522/CORS: não tenta fallback (também falharia)
        const msg = String(error?.message || '');
        if (/Failed to fetch|NetworkError|fetch/i.test(msg) || error?.code === 'PGRST301') {
            console.warn('companies indisponível:', error?.message);
            return { company_name: '' };
        }

        // Fallback: profiles NÃO tem company_name — só full_name/email
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('company_id', companyId)
            .limit(1)
            .maybeSingle();

        return { company_name: profile?.full_name || '' };
    },
    async saveCompanyProfile(id: string, updates: any) {
        // Mapear campos do frontend para o esquema do banco de dados
        const dbUpdates = {
            id,
            name: updates.company_name,
            document: updates.cnpj,
            phone: updates.phone,
            email: updates.email,
            address: updates.address
        };

        const { data, error } = await supabase
            .from('companies')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    }
};

export const profileService = {
    async getUsers(companyId: string) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('company_id', companyId);
        if (error) throw error;
        return data;
    },
    async deleteUser(userId: string) {
        // Nota: Delete em profiles pode exigir deletar o user no Auth (depende do RLS e Trigger)
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);
        if (error) throw error;
    },
    async addUser(user: any) {
        const { data, error } = await supabase
            .from('profiles')
            .insert([user])
            .select()
            .single();
        if (error) throw error;
        return data;
    },
    async updateUser(id: string, updates: any) {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    }
};

// URLs de checkout Kiwify por plano (fallback se RPC/master_settings falhar).
export const KIWIFY_CHECKOUT_URLS: Record<string, string> = {
    basico:    'https://pay.kiwify.com.br/Xo5neXV',
    pro:       'https://pay.kiwify.com.br/9f3rjhC',
    enterprise:'https://pay.kiwify.com.br/itrSZqN',
};

/** Lê checkout_url_* de master_settings via RPC pública; fallback nas constantes. */
export async function getCheckoutUrls(): Promise<Record<string, string>> {
    try {
        const { data, error } = await supabase.rpc('get_public_checkout_urls');
        if (error) throw error;
        const map = (data && typeof data === 'object' ? data : {}) as Record<string, string>;
        return {
            basico:     String(map.checkout_url_basico || map.basico || KIWIFY_CHECKOUT_URLS.basico),
            pro:        String(map.checkout_url_pro || map.pro || KIWIFY_CHECKOUT_URLS.pro),
            enterprise: String(map.checkout_url_enterprise || map.enterprise || KIWIFY_CHECKOUT_URLS.enterprise),
        };
    } catch {
        return { ...KIWIFY_CHECKOUT_URLS };
    }
}

export const subscriptionService = {
    async getSubscription(companyId: string) {
        const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('company_id', companyId)
            .maybeSingle();
        if (error) throw error;
        return data;
    },
    async createKiwifyCheckout(plan: string): Promise<string> {
        const urls = await getCheckoutUrls();
        const url = urls[plan.toLowerCase()];
        if (!url) throw new Error(`Plano "${plan}" não encontrado. Configure a URL no Master → Configurações Globais.`);
        return url;
    }
};

export const conjuntoHistoryService = {
    async getHistory(vehicleId: string) {
        const { data, error } = await supabase
            .from('vehicle_implement_history')
            .select('*')
            .eq('vehicle_id', vehicleId)
            .order('started_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async createInitialRecord(companyId: string, vehicleId: string, plate1: string | null, plate2: string | null) {
        if (!plate1 && !plate2) return null;
        const { data, error } = await supabase
            .from('vehicle_implement_history')
            .insert([{
                company_id: companyId,
                vehicle_id: vehicleId,
                implement_plate_1: plate1 || null,
                implement_plate_2: plate2 || null,
                started_at: new Date().toISOString()
            }])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async swapConjunto(vehicleId: string, companyId: string, newPlate1: string | null, newPlate2: string | null, swapDate: string, notes: string) {
        const swapTs = `${swapDate}T12:00:00.000Z`;

        // 1. Para cada novo implemento, verifica se já está em outro veículo
        //    e remove de lá automaticamente (sem duplicidade)
        const platesToCheck = [newPlate1, newPlate2].filter(Boolean) as string[];
        for (const plate of platesToCheck) {
            const { data: otherVehicles } = await supabase
                .from('vehicles')
                .select('id, implement_plate_1, implement_plate_2')
                .neq('id', vehicleId)
                .eq('company_id', companyId)
                .or(`implement_plate_1.eq.${plate},implement_plate_2.eq.${plate}`);

            for (const ov of otherVehicles || []) {
                // Fecha histórico do veículo que perderá o implemento
                await supabase
                    .from('vehicle_implement_history')
                    .update({ ended_at: swapTs })
                    .eq('vehicle_id', ov.id)
                    .is('ended_at', null);

                // Remove só a placa conflitante, mantém a outra se existir
                const ovPlate1 = ov.implement_plate_1 === plate ? null : ov.implement_plate_1;
                const ovPlate2 = ov.implement_plate_2 === plate ? null : ov.implement_plate_2;

                await supabase
                    .from('vehicles')
                    .update({ implement_plate_1: ovPlate1, implement_plate_2: ovPlate2 })
                    .eq('id', ov.id);

                // Cria novo registro de histórico para o veículo que perdeu o implemento
                if (ovPlate1 || ovPlate2) {
                    await supabase
                        .from('vehicle_implement_history')
                        .insert([{
                            company_id: companyId,
                            vehicle_id: ov.id,
                            implement_plate_1: ovPlate1,
                            implement_plate_2: ovPlate2,
                            started_at: swapTs,
                            notes: `Implemento ${plate} removido automaticamente por troca de conjunto`
                        }]);
                }
            }
        }

        // 2. Encerra o registro atual do cavalo que está recebendo os novos implementos
        const { error: closeError } = await supabase
            .from('vehicle_implement_history')
            .update({ ended_at: swapTs })
            .eq('vehicle_id', vehicleId)
            .is('ended_at', null);
        if (closeError) throw closeError;

        // 3. Atualiza as placas no veículo atual
        const { error: vErr } = await supabase
            .from('vehicles')
            .update({ implement_plate_1: newPlate1 || null, implement_plate_2: newPlate2 || null })
            .eq('id', vehicleId);
        if (vErr) throw vErr;

        // 4. Abre novo registro de histórico para o cavalo atual
        if (newPlate1 || newPlate2) {
            const { error: insertErr } = await supabase
                .from('vehicle_implement_history')
                .insert([{
                    company_id: companyId,
                    vehicle_id: vehicleId,
                    implement_plate_1: newPlate1 || null,
                    implement_plate_2: newPlate2 || null,
                    started_at: swapTs,
                    notes: notes || null
                }]);
            if (insertErr) throw insertErr;
        }
    }
};

export const leadService = {
    async createLead(lead: any) {
        const { data, error } = await supabase
            .from('leads')
            .insert([lead])
            .select()
            .single();
        if (error) throw error;
        return data;
    }
};

export const dashboardService = {
    async getTruckProfitability(companyId: string, startDate?: string, endDate?: string) {
        const endExclusive = endDate ? saoPauloEndExclusive(endDate) : undefined;

        let tripQuery = supabase
            .from('trips')
            .select('vehicle_id, gross_value, commission_rate, tax_rate, tolls_value, insurance_value, icms_value, estimated_cost, loading_cost, unloading_cost, created_at, vehicle:vehicles!trips_vehicle_id_fkey(plate)')
            .eq('company_id', companyId);

        let fuelQuery = supabase
            .from('fuel_records')
            .select('vehicle_id, total_value, arla_value, created_at')
            .eq('company_id', companyId);

        let maintQuery = supabase
            .from('maintenance')
            .select('vehicle_id, cost')
            .eq('company_id', companyId);

        if (startDate) {
            tripQuery = tripQuery.gte('created_at', saoPauloStart(startDate));
            fuelQuery = fuelQuery.gte('created_at', saoPauloStart(startDate));
            maintQuery = maintQuery.gte('date', startDate);
        }
        if (endExclusive) {
            tripQuery = tripQuery.lt('created_at', endExclusive);
            fuelQuery = fuelQuery.lt('created_at', endExclusive);
        }
        if (endDate) {
            maintQuery = maintQuery.lte('date', endDate);
        }

        const [
            { data: trips, error: tError },
            { data: fuels, error: fError },
            { data: maints, error: mError },
            { data: vehList }
        ] = await Promise.all([
            tripQuery, fuelQuery, maintQuery,
            supabase.from('vehicles').select('id, category').eq('company_id', companyId)
        ]);

        if (tError || fError || mError) throw tError || fError || mError;

        // Ranking é de cavalos/caminhões — ignora implementos (custo deles já entra no DRE)
        const implementIds = new Set((vehList ?? []).filter((v: any) => v.category === 'implemento').map((v: any) => v.id));

        let commissionBase = normalizeCommissionBase('net_tax');
        try {
            const s = await settingsService.getSettings(companyId);
            commissionBase = normalizeCommissionBase(s?.commission_base);
        } catch { /* default */ }

        const profitByTruck: Record<string, { vehicle_id: string; plate: string; gross: number; expenses: number; net: number }> = {};

        trips?.forEach(t => {
            const vId = t.vehicle_id;
            if (!vId || implementIds.has(vId)) return;
            if (!profitByTruck[vId]) {
                const vehicleData: any = t.vehicle;
                profitByTruck[vId] = { vehicle_id: vId, plate: vehicleData?.plate || '---', gross: 0, expenses: 0, net: 0 };
            }
            const gross = Number(t.gross_value) || 0;
            const { expenses: br, commission } = calcTripCommission(t, commissionBase);
            profitByTruck[vId].gross += gross;
            profitByTruck[vId].expenses += commission + br.taxAmount + br.icms + br.tolls + br.insurance + br.loading + br.unloading;
        });

        fuels?.forEach(f => {
            const vId = f.vehicle_id;
            if (!vId || implementIds.has(vId)) return;
            if (!profitByTruck[vId]) {
                profitByTruck[vId] = { vehicle_id: vId, plate: '---', gross: 0, expenses: 0, net: 0 };
            }
            profitByTruck[vId].expenses += (Number(f.total_value) || 0) + (Number((f as any).arla_value) || 0);
        });

        maints?.forEach((m: any) => {
            const vId = m.vehicle_id;
            if (!vId || implementIds.has(vId)) return;
            if (!profitByTruck[vId]) {
                profitByTruck[vId] = { vehicle_id: vId, plate: '---', gross: 0, expenses: 0, net: 0 };
            }
            profitByTruck[vId].expenses += Number(m.cost) || 0;
        });

        Object.values(profitByTruck).forEach(truck => {
            truck.net = truck.gross - truck.expenses;
        });

        return Object.values(profitByTruck).sort((a, b) => b.net - a.net);
    },

    async getVehicleAnalytics(companyId: string, vehicleId: string, startDate?: string, endDate?: string) {
        if (!companyId || !vehicleId) throw new Error("ID da empresa ou do veículo não informado.");
        const endExclusive = endDate ? saoPauloEndExclusive(endDate) : undefined;

        let tripsQuery = supabase.from('trips').select('*, driver:drivers(name)').eq('vehicle_id', vehicleId).eq('company_id', companyId).order('created_at', { ascending: false });
        let fuelsQuery = supabase.from('fuel_records').select('*, driver:drivers(name)').eq('vehicle_id', vehicleId).eq('company_id', companyId).order('odometer', { ascending: true });
        let maintQuery = supabase.from('maintenance').select('*').eq('vehicle_id', vehicleId).eq('company_id', companyId).order('date', { ascending: false });

        if (startDate) {
            tripsQuery = tripsQuery.gte('created_at', saoPauloStart(startDate));
            fuelsQuery = fuelsQuery.gte('created_at', saoPauloStart(startDate));
            maintQuery = maintQuery.gte('date', startDate);
        }
        if (endExclusive) {
            tripsQuery = tripsQuery.lt('created_at', endExclusive);
            fuelsQuery = fuelsQuery.lt('created_at', endExclusive);
        }
        if (endDate) {
            maintQuery = maintQuery.lte('date', endDate);
        }

        const [
            { data: vehicle, error: vError },
            { data: trips, error: tError },
            { data: fuels, error: fError },
            { data: maintenances, error: mError }
        ] = await Promise.all([
            supabase.from('vehicles').select('*').eq('id', vehicleId).eq('company_id', companyId).single(),
            tripsQuery,
            fuelsQuery,
            maintQuery
        ]);

        if (vError || tError || fError || mError) throw vError || tError || fError || mError;

        // Faturamento bruto (todas as viagens)
        const totalGross = trips?.reduce((acc, t) => acc + (Number(t.gross_value) || 0), 0) || 0;

        // Combustível diesel + ARLA
        const totalFuel = fuels?.reduce((acc, f) => acc + (Number(f.total_value) || 0), 0) || 0;
        const totalArla = fuels?.reduce((acc, f) => acc + (Number((f as any).arla_value) || 0), 0) || 0;

        // Manutenção
        const totalMaint = maintenances?.reduce((acc, m) => acc + (Number((m as any).cost) || 0), 0) || 0;

        // Pedágio + ICMS + carregamento/descarga (custo por viagem)
        const totalTolls = trips?.reduce((acc, t) => acc + (Number((t as any).tolls_value) || 0), 0) || 0;
        const totalIcms = trips?.reduce((acc, t) => acc + (Number((t as any).icms_value) || 0), 0) || 0;
        const totalInsurance = trips?.reduce((acc, t) => acc + (Number((t as any).insurance_value) || 0), 0) || 0;
        const totalLoading = trips?.reduce((acc, t) => acc + (Number((t as any).loading_cost) || 0), 0) || 0;
        const totalUnloading = trips?.reduce((acc, t) => acc + (Number((t as any).unloading_cost) || 0), 0) || 0;

        let commissionBase = normalizeCommissionBase('net_tax');
        try {
            const s = await settingsService.getSettings(companyId);
            commissionBase = normalizeCommissionBase(s?.commission_base);
        } catch { /* default */ }

        const totalCommission = trips?.reduce((acc, t) => {
            return acc + calcTripCommission(t, commissionBase).commission;
        }, 0) || 0;

        // Imposto: gross_value * tax_rate / 100 por viagem
        const totalTax = trips?.reduce((acc, t) => {
            const rate = Number((t as any).tax_rate) || 0;
            return acc + (Number(t.gross_value) || 0) * rate / 100;
        }, 0) || 0;

        // Resultado líquido = Faturamento - todas as despesas
        const totalExpenses = totalFuel + totalArla + totalMaint + totalTolls + totalIcms + totalInsurance + totalLoading + totalUnloading + totalCommission + totalTax;
        const netProfit = totalGross - totalExpenses;

        // KM/L: média das leituras consecutivas válidas (evita distorções por leituras extremas)
        let avgKmPerLiter = 0;
        if (fuels && fuels.length > 1) {
            const sorted = [...fuels]
                .filter((a: any) => isDieselFuel(a.fuel_type) && Number(a.liters) > 0)
                .sort((a: any, b: any) => Number(a.odometer) - Number(b.odometer));
            const readings: number[] = [];
            for (let i = 1; i < sorted.length; i++) {
                const kmDelta = Number(sorted[i].odometer) - Number(sorted[i - 1].odometer);
                const liters = Number(sorted[i].liters) || 0;
                // Filtra leituras inválidas (km negativo, 0 litros ou range absurdo > 5000 km)
                if (kmDelta > 0 && liters > 0 && kmDelta < 5000) {
                    readings.push(kmDelta / liters);
                }
            }
            if (readings.length > 0) {
                avgKmPerLiter = readings.reduce((a, b) => a + b, 0) / readings.length;
            }
        }

        return {
            vehicle,
            stats: {
                totalGross,
                totalFuel,
                totalArla,
                totalMaint,
                totalTolls,
                totalIcms,
                totalInsurance,
                totalLoading,
                totalUnloading,
                totalCommission,
                totalTax,
                totalExpenses,
                netProfit,
                avgKmPerLiter,
            },
            history: {
                trips: (trips || []).slice(0, 10),
                fuels: [...(fuels || [])].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10),
                maintenances: (maintenances || []).slice(0, 10)
            }
        };
    },

    /** Ano civil completo do veículo: totais e listas sem corte. */
    async getVehicleYearReport(companyId: string, vehicleId: string, year: number) {
        if (!companyId || !vehicleId) throw new Error('ID da empresa ou do veículo não informado.');
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        const maint = utcCalendarRange(startDate, endDate);

        const [
            { data: vehicle, error: vError },
            { data: trips, error: tError },
            { data: fuels, error: fError },
            { data: maintenances, error: mError },
            company,
        ] = await Promise.all([
            supabase.from('vehicles').select('*').eq('id', vehicleId).eq('company_id', companyId).single(),
            supabase.from('trips').select('*, driver:drivers(name)').eq('vehicle_id', vehicleId).eq('company_id', companyId)
                .gte('created_at', saoPauloStart(startDate)).lt('created_at', saoPauloEndExclusive(endDate))
                .order('created_at', { ascending: true }),
            supabase.from('fuel_records').select('*, driver:drivers(name)').eq('vehicle_id', vehicleId).eq('company_id', companyId)
                .gte('created_at', saoPauloStart(startDate)).lt('created_at', saoPauloEndExclusive(endDate))
                .order('created_at', { ascending: true }),
            supabase.from('maintenance').select('*').eq('vehicle_id', vehicleId).eq('company_id', companyId)
                .gte('date', maint.gte).lt('date', maint.lt)
                .order('date', { ascending: true }),
            settingsService.getCompanyProfile(companyId).catch(() => ({ company_name: '' })),
        ]);

        if (vError || tError || fError || mError) throw vError || tError || fError || mError;

        const tripRows = trips || [];
        const fuelRows = fuels || [];
        const maintRows = maintenances || [];

        const totalGross = tripRows.reduce((acc, t) => acc + (Number(t.gross_value) || 0), 0);
        const totalFuel = fuelRows.reduce((acc, f) => acc + (Number(f.total_value) || 0), 0);
        const totalArla = fuelRows.reduce((acc, f) => acc + (Number((f as any).arla_value) || 0), 0);
        const totalMaint = maintRows.reduce((acc, m) => acc + (Number((m as any).cost) || 0), 0);
        const totalTolls = tripRows.reduce((acc, t) => acc + (Number((t as any).tolls_value) || 0), 0);
        const totalIcms = tripRows.reduce((acc, t) => acc + (Number((t as any).icms_value) || 0), 0);
        const totalInsurance = tripRows.reduce((acc, t) => acc + (Number((t as any).insurance_value) || 0), 0);
        const totalLoading = tripRows.reduce((acc, t) => acc + (Number((t as any).loading_cost) || 0), 0);
        const totalUnloading = tripRows.reduce((acc, t) => acc + (Number((t as any).unloading_cost) || 0), 0);

        let commissionBase = normalizeCommissionBase('net_tax');
        try {
            const s = await settingsService.getSettings(companyId);
            commissionBase = normalizeCommissionBase(s?.commission_base);
        } catch { /* default */ }

        const totalCommission = tripRows.reduce((acc, t) => acc + calcTripCommission(t, commissionBase).commission, 0);
        const totalTax = tripRows.reduce((acc, t) => {
            const rate = Number((t as any).tax_rate) || 0;
            return acc + (Number(t.gross_value) || 0) * rate / 100;
        }, 0);
        const totalExpenses = totalFuel + totalArla + totalMaint + totalTolls + totalIcms + totalInsurance + totalLoading + totalUnloading + totalCommission + totalTax;
        const netProfit = totalGross - totalExpenses;

        let avgKmPerLiter = 0;
        if (fuelRows.length > 1) {
            const sorted = [...fuelRows]
                .filter((a: any) => isDieselFuel(a.fuel_type) && Number(a.liters) > 0)
                .sort((a: any, b: any) => Number(a.odometer) - Number(b.odometer));
            const readings: number[] = [];
            for (let i = 1; i < sorted.length; i++) {
                const kmDelta = Number(sorted[i].odometer) - Number(sorted[i - 1].odometer);
                const liters = Number(sorted[i].liters) || 0;
                if (kmDelta > 0 && liters > 0 && kmDelta < 5000) readings.push(kmDelta / liters);
            }
            if (readings.length > 0) avgKmPerLiter = readings.reduce((a, b) => a + b, 0) / readings.length;
        }

        return {
            year,
            companyName: (company as any)?.name || (company as any)?.company_name || '',
            vehicle,
            stats: {
                totalGross, totalFuel, totalArla, totalMaint, totalTolls, totalIcms, totalInsurance,
                totalLoading, totalUnloading, totalCommission, totalTax, totalExpenses, netProfit,             avgKmPerLiter,
                tripCount: tripRows.length,
                fuelCount: fuelRows.length,
                maintCount: maintRows.length,
            },
            commissionBase,
            trips: tripRows,
            fuels: fuelRows,
            maintenances: maintRows,
        };
    },

    async getDriverAverages(companyId: string, startDate?: string, endDate?: string) {
        let query = supabase
            .from('fuel_records')
            .select('driver_id, vehicle_id, odometer, liters, fuel_type, created_at, driver:drivers(name)')
            .eq('company_id', companyId)
            .order('odometer', { ascending: true });

        if (startDate) query = query.gte('created_at', saoPauloStart(startDate));
        if (endDate) query = query.lt('created_at', endDate.includes('T') ? endDate : saoPauloEndExclusive(endDate));

        const { data: fuels, error } = await query;
        if (error) throw error;

        const driverStats: Record<string, { name: string; totalLiters: number; count: number; totalKmDriven: number }> = {};
        const vehicleKm: Record<string, number> = {};

        // Melhora: Se houver registros no período, buscar o último KM de cada veículo ANTES do período
        // para servir de base para o primeiro abastecimento do mês.
        if (startDate && fuels && fuels.length > 0) {
            const vehicleIds = [...new Set(fuels.map(f => f.vehicle_id).filter(id => !!id))];
            const { data: baselines } = await supabase
                .from('fuel_records')
                .select('vehicle_id, odometer')
                .eq('company_id', companyId)
                .in('vehicle_id', vehicleIds)
                .lt('created_at', saoPauloStart(startDate))
                .order('odometer', { ascending: false });
            
            baselines?.forEach(b => {
                if (b.vehicle_id && !vehicleKm[b.vehicle_id]) {
                    vehicleKm[b.vehicle_id] = Number(b.odometer);
                }
            });
        }

        fuels?.forEach(f => {
            if (!f.driver_id || !f.vehicle_id || !isDieselFuel(f.fuel_type)) return;
            
            const dId = f.driver_id;
            const vId = f.vehicle_id;

            if (!driverStats[dId]) {
                const driverData: any = f.driver;
                driverStats[dId] = {
                    name: driverData?.name || 'Desconhecido',
                    totalLiters: 0,
                    count: 0,
                    totalKmDriven: 0
                };
            }

            const stat = driverStats[dId];
            stat.count++;
            stat.totalLiters += Number(f.liters) || 0;

            const currentKm = Number(f.odometer);
            const prevKm = vehicleKm[vId] || 0;
            
            if (prevKm > 0) {
                const diff = currentKm - prevKm;
                if (diff > 0 && diff < 15000) { 
                    stat.totalKmDriven += diff;
                }
            }
            vehicleKm[vId] = currentKm;
        });

        return Object.values(driverStats)
            .filter(d => d.totalKmDriven > 0 && d.totalLiters > 0)
            .map(d => ({
                name: d.name,
                kmPerLiter: d.totalKmDriven / d.totalLiters,
                totalKm: d.totalKmDriven
            }))
            .sort((a, b) => b.kmPerLiter - a.kmPerLiter);
    },

    async getSystemAlerts(companyId: string) {
        const alerts: any[] = [];
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        const vehicleCols = 'id, plate, category, current_km, maint_oil_interval, last_oil_change_km, maint_filter_interval, last_filter_change_km, maint_tyre_interval, last_tyre_change_km, document_expiry, antt_expiry, civ_expiry, tacografo_expiry, cipp_expiry, afericao_expiry';
        const driverCols = 'id, name, license_expiry, aso_expiry, nr20_expiry, nr35_expiry, mopp_expiry';

        let vehiclesRes = await Promise.all([
            supabase.from('vehicles').select(vehicleCols).eq('company_id', companyId),
            supabase.from('maintenance')
                .select('vehicle_id, type, preventive_type, km, next_maintenance_km, maintenance_interval, next_maintenance_date')
                .eq('company_id', companyId)
                .order('date', { ascending: false }),
            supabase.from('drivers').select(driverCols).eq('company_id', companyId),
            supabase.from('tyres')
                .select('id, vehicle_id, position, tread_depth_mm, brand')
                .eq('company_id', companyId)
                .lte('tread_depth_mm', 1.6),
        ]);

        // Fallback se colunas opcionais ainda não existem no banco
        if (vehiclesRes[0].error || vehiclesRes[2].error) {
            vehiclesRes = await Promise.all([
                supabase.from('vehicles').select('*').eq('company_id', companyId),
                vehiclesRes[1].error
                    ? supabase.from('maintenance')
                        .select('vehicle_id, type, preventive_type, km, next_maintenance_km, maintenance_interval, next_maintenance_date')
                        .eq('company_id', companyId)
                        .order('date', { ascending: false })
                    : Promise.resolve(vehiclesRes[1]),
                supabase.from('drivers').select('*').eq('company_id', companyId),
                Promise.resolve(vehiclesRes[3]),
            ]);
        }

        const [
            { data: vehicles, error: vError },
            { data: maintenances, error: mError },
            { data: drivers, error: dError },
            { data: tyres, error: tError },
        ] = vehiclesRes;

        if (vError) throw vError;
        if (mError) throw mError;
        if (dError) throw dError;
        if (tError) throw tError;

        // Helper genérico de alerta de documento (janela de 30 dias / crítico se vencido)
        const pushDocAlert = (idPrefix: string, entityLabel: string, docLabel: string, dateVal: any) => {
            if (!dateVal) return;
            const expiry = new Date(String(dateVal).slice(0, 10) + 'T12:00:00');
            if (isNaN(expiry.getTime()) || expiry > thirtyDaysFromNow) return;
            alerts.push({
                id: idPrefix,
                type: 'Document',
                title: `${docLabel} - ${entityLabel}`,
                message: expiry <= today
                    ? `CRITICAL: ${docLabel} vencido em ${expiry.toLocaleDateString('pt-BR')}.`
                    : `${docLabel} vence em ${expiry.toLocaleDateString('pt-BR')}.`,
                severity: expiry <= today ? 'critical' : 'warning',
                date: new Date().toISOString()
            });
        };

        // Registro mais recente por veículo+tipo (apenas para os tipos especiais por KM/data)
        const SPECIAL_TYPES = ['freios', 'correias', 'revisao_geral', 'tacografo'];
        const lastMaintenances: Record<string, any> = {};
        // KM mais recente de óleo e filtros por veículo (da tabela de manutenção)
        const lastOilKmByVehicle: Record<string, number> = {};
        const lastFilterKmByVehicle: Record<string, number> = {};

        maintenances?.forEach(m => {
            // Só popula lastMaintenances para tipos especiais (evita alertas genéricos)
            if (SPECIAL_TYPES.includes(m.preventive_type)) {
                const key = `${m.vehicle_id}-${m.preventive_type}`;
                if (!lastMaintenances[key]) lastMaintenances[key] = m;
            }

            // Captura km de óleo registrado diretamente como type='oil' ou preventive_type='oleo'
            const mKm = Number(m.km) || 0;
            if (mKm > 0) {
                if (m.type === 'oil' || m.preventive_type === 'oleo') {
                    if (!lastOilKmByVehicle[m.vehicle_id] || mKm > lastOilKmByVehicle[m.vehicle_id]) {
                        lastOilKmByVehicle[m.vehicle_id] = mKm;
                    }
                }
                if (m.preventive_type === 'filtros') {
                    if (!lastFilterKmByVehicle[m.vehicle_id] || mKm > lastFilterKmByVehicle[m.vehicle_id]) {
                        lastFilterKmByVehicle[m.vehicle_id] = mKm;
                    }
                }
            }
        });

        // Helper para gerar alerta de km
        const pushKmAlert = (vehicleId: string, plate: string, typeKey: string, typeLabel: string, remaining: number, interval: number, currentKm: number) => {
            const threshold = interval * 0.1;
            // Alerta quando faltam <= 10% do intervalo ou já passou, mas não mais que um intervalo inteiro atrás
            if (remaining <= threshold && remaining > -interval) {
                alerts.push({
                    id: `maint-${vehicleId}-${typeKey}`,
                    type: 'Maintenance',
                    title: `${typeLabel} - ${plate}`,
                    message: remaining <= 0
                        ? `ATENÇÃO: Quilometragem atingida (${currentKm.toLocaleString('pt-BR')}km). Realize a manutenção imediatamente.`
                        : `Faltam ${remaining.toLocaleString('pt-BR')}km para a ${typeLabel.toLowerCase()}.`,
                    severity: remaining <= 0 ? 'critical' : 'warning',
                    date: new Date().toISOString()
                });
            }
        };

        vehicles?.forEach(v => {
            const currentKm = Number(v.current_km) || 0;

            // ── Óleo: usa o maior km entre campo do veículo e registros de manutenção ──
            const oilInterval = Number(v.maint_oil_interval) || 0;
            const lastOil = Math.max(Number(v.last_oil_change_km) || 0, lastOilKmByVehicle[v.id] || 0);
            if (oilInterval > 0 && lastOil > 0) {
                pushKmAlert(v.id, v.plate, 'oleo', 'Troca de Óleo', (lastOil + oilInterval) - currentKm, oilInterval, currentKm);
            }

            // ── Filtro: usa o maior km entre campo do veículo e registros de manutenção ──
            const filterInterval = Number(v.maint_filter_interval) || 0;
            const lastFilter = Math.max(Number(v.last_filter_change_km) || 0, lastFilterKmByVehicle[v.id] || 0);
            if (filterInterval > 0 && lastFilter > 0) {
                pushKmAlert(v.id, v.plate, 'filtros', 'Troca de Filtros', (lastFilter + filterInterval) - currentKm, filterInterval, currentKm);
            }

            // ── Pneu: usa campos do veículo ──
            const tyreInterval = Number(v.maint_tyre_interval) || 0;
            const lastTyre = Number(v.last_tyre_change_km) || 0;
            if (tyreInterval > 0 && lastTyre > 0) {
                pushKmAlert(v.id, v.plate, 'pneu', 'Troca de Pneus', (lastTyre + tyreInterval) - currentKm, tyreInterval, currentKm);
            }

            // ── Freios / Correias / Revisão Geral: usa registros da tabela de manutenção (por KM) ──
            // ── Tacógrafo: usa registros da tabela de manutenção (por DATA) ──
            const specialTypes = Object.values(lastMaintenances).filter((m: any) => m.vehicle_id === v.id);
            specialTypes.forEach((m: any) => {
                if (m.preventive_type === 'tacografo') {
                    // Alerta por DATA
                    if (!m.next_maintenance_date) return;
                    const nextDate = new Date(m.next_maintenance_date);
                    const diffMs = nextDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    // Alerta se vence em até 30 dias ou já venceu (mas não mais de 365 dias atrás)
                    if (diffDays <= 30 && diffDays > -365) {
                        alerts.push({
                            id: `maint-${v.id}-tacografo`,
                            type: 'Maintenance',
                            title: `Aferição de Tacógrafo - ${v.plate}`,
                            message: diffDays <= 0
                                ? `ATENÇÃO: Aferição vencida em ${nextDate.toLocaleDateString('pt-BR')}. Regularize imediatamente.`
                                : `Aferição do tacógrafo vence em ${diffDays} dia${diffDays > 1 ? 's' : ''} (${nextDate.toLocaleDateString('pt-BR')}).`,
                            severity: diffDays <= 0 ? 'critical' : 'warning',
                            date: new Date().toISOString()
                        });
                    }
                } else {
                    const nextKm = Number(m.next_maintenance_km);
                    const interval = Number(m.maintenance_interval) || 10000;
                    const remaining = nextKm - currentKm;
                    const typeLabel = m.preventive_type === 'freios' ? 'Revisão de Freios' :
                                      m.preventive_type === 'correias' ? 'Troca de Correias' :
                                      m.preventive_type === 'revisao_geral' ? 'Revisão Geral' : 'Manutenção';
                    if (nextKm > 0) pushKmAlert(v.id, v.plate, m.preventive_type, typeLabel, remaining, interval, currentKm);
                }
            });

            // Alertas de Documentos do Veículo / Implemento
            const vLabel = (v as any).category === 'implemento' ? `${v.plate} (Implemento)` : v.plate;
            pushDocAlert(`doc-v-${v.id}`, vLabel, 'Licenciamento', v.document_expiry);
            pushDocAlert(`antt-v-${v.id}`, vLabel, 'ANTT', v.antt_expiry);
            pushDocAlert(`civ-v-${v.id}`, vLabel, 'CIV', (v as any).civ_expiry);
            pushDocAlert(`taco-v-${v.id}`, vLabel, 'Cronotacógrafo', (v as any).tacografo_expiry);
            pushDocAlert(`cipp-v-${v.id}`, vLabel, 'CIPP', (v as any).cipp_expiry);
            pushDocAlert(`afer-v-${v.id}`, vLabel, 'Aferição do Tanque', (v as any).afericao_expiry);
        });

        // Alertas de Documentos de Motoristas (CNH, ASO, NRs, MOPP)
        drivers?.forEach(d => {
            pushDocAlert(`doc-d-${d.id}`, d.name, 'CNH', d.license_expiry);
            pushDocAlert(`aso-d-${d.id}`, d.name, 'ASO', (d as any).aso_expiry);
            pushDocAlert(`nr20-d-${d.id}`, d.name, 'NR20', (d as any).nr20_expiry);
            pushDocAlert(`nr35-d-${d.id}`, d.name, 'NR35', (d as any).nr35_expiry);
            pushDocAlert(`mopp-d-${d.id}`, d.name, 'MOPP', (d as any).mopp_expiry);
        });

        // Alertas de Pneus
        tyres?.forEach(t => {
            const vehicle = vehicles?.find(v => v.id === t.vehicle_id);
            alerts.push({
                id: `tyre-${t.id}`,
                type: 'Tyre',
                title: `Pneu Crítico - ${vehicle?.plate || '---'}`,
                message: `Pneu na posição ${t.position} (${t.brand || 'S/N'}) está com sulco de ${t.tread_depth_mm}mm. Troca necessária.`,
                severity: 'critical',
                date: new Date().toISOString()
            });
        });

        return alerts.sort((a, b) => {
            if (a.severity === 'critical' && b.severity !== 'critical') return -1;
            if (a.severity !== 'critical' && b.severity === 'critical') return 1;
            return 0;
        });
    },

    async getDriverEfficiency(companyId: string, startDate?: string, endDate?: string) {
        // Busca viagens para receita por motorista e veículo principal usado
        let tripQuery = supabase
            .from('trips')
            .select('driver_id, vehicle_id, gross_value, created_at, driver:drivers(name), vehicle:vehicles!trips_vehicle_id_fkey(plate)')
            .eq('company_id', companyId);

        // Busca abastecimentos agrupados por veículo para calcular KM/L do veículo
        let fuelQuery = supabase
            .from('fuel_records')
            .select('vehicle_id, liters, odometer, fuel_type, created_at')
            .eq('company_id', companyId)
            .order('odometer', { ascending: true });

        if (startDate) {
            tripQuery = tripQuery.gte('created_at', saoPauloStart(startDate));
            fuelQuery = fuelQuery.gte('created_at', saoPauloStart(startDate));
        }
        if (endDate) {
            tripQuery = tripQuery.lt('created_at', saoPauloEndExclusive(endDate));
            fuelQuery = fuelQuery.lt('created_at', saoPauloEndExclusive(endDate));
        }

        const [{ data: trips, error: tError }, { data: fuels, error: fError }] = await Promise.all([tripQuery, fuelQuery]);
        if (tError || fError) throw tError || fError;

        // KM/L por veículo (baseado nos abastecimentos do veículo)
        const fuelByVehicle: Record<string, any[]> = {};
        fuels?.forEach(f => {
            if (!f.vehicle_id) return;
            if (!fuelByVehicle[f.vehicle_id]) fuelByVehicle[f.vehicle_id] = [];
            fuelByVehicle[f.vehicle_id].push(f);
        });

        const vehicleKmPerLiter: Record<string, number> = {};
        Object.keys(fuelByVehicle).forEach(vId => {
            const records = fuelByVehicle[vId];
            if (records.length < 2) return;
            let totalLiters = 0;
            let totalKm = 0;
            let previousKm = 0;
            records.forEach(r => {
                const liters = Number(r.liters) || 0;
                if (!isDieselFuel(r.fuel_type) || liters <= 0) return;
                const currentKm = Number(r.odometer);
                totalLiters += liters;
                if (previousKm > 0) {
                    const diff = currentKm - previousKm;
                    if (diff > 0 && diff < 15000) totalKm += diff;
                }
                previousKm = currentKm;
            });
            if (totalLiters > 0 && totalKm > 0) vehicleKmPerLiter[vId] = totalKm / totalLiters;
        });

        // Agrupa receita por motorista e identifica veículo principal (último usado)
        const driverStats: Record<string, { driver: string; vehicleId: string; plate: string; revenue: number }> = {};
        trips?.forEach(t => {
            const dId = t.driver_id;
            if (!dId) return;
            const driverData: any = t.driver;
            const vehicleData: any = t.vehicle;
            if (!driverStats[dId]) {
                driverStats[dId] = { driver: driverData?.name || '---', vehicleId: t.vehicle_id || '', plate: vehicleData?.plate || '---', revenue: 0 };
            }
            driverStats[dId].revenue += Number(t.gross_value) || 0;
            // Atualiza para o veículo mais recente (viagens estão em ordem desc)
            if (t.vehicle_id && !driverStats[dId].vehicleId) {
                driverStats[dId].vehicleId = t.vehicle_id;
                driverStats[dId].plate = vehicleData?.plate || '---';
            }
        });

        return Object.values(driverStats).map(d => ({
            driver: d.driver,
            truck: d.plate,
            revenue: d.revenue,
            kmPerLiter: vehicleKmPerLiter[d.vehicleId] || 0
        })).sort((a, b) => b.kmPerLiter - a.kmPerLiter);
    },

    async getVehicleEfficiency(companyId: string, startDate?: string, endDate?: string) {
        let fuelQuery = supabase
            .from('fuel_records')
            .select('vehicle_id, total_value, arla_value, liters, fuel_type, created_at, odometer, vehicle:vehicles(plate, model)')
            .eq('company_id', companyId)
            .order('odometer', { ascending: true });

        let tripQuery = supabase
            .from('trips')
            .select('vehicle_id, gross_value, created_at')
            .eq('company_id', companyId);

        if (startDate) {
            fuelQuery = fuelQuery.gte('created_at', saoPauloStart(startDate));
            tripQuery = tripQuery.gte('created_at', saoPauloStart(startDate));
        }
        if (endDate) {
            fuelQuery = fuelQuery.lt('created_at', saoPauloEndExclusive(endDate));
            tripQuery = tripQuery.lt('created_at', saoPauloEndExclusive(endDate));
        }

        const [{ data: fuels, error: fError }, { data: trips, error: tError }] = await Promise.all([fuelQuery, tripQuery]);
        if (fError || tError) throw fError || tError;

        const vehicleStats: Record<string, { vehicle_id: string; plate: string; model: string; liters: number; fuelCost: number; arlaCost: number; kmDriven: number; revenue: number; lastOdometer: number }> = {};

        const vehicleKmBaseline: Record<string, number> = {};
        if (startDate && fuels && fuels.length > 0) {
            const vehicleIds = [...new Set(fuels.map(f => f.vehicle_id).filter(Boolean))];
            const { data: baselines } = await supabase
                .from('fuel_records')
                .select('vehicle_id, odometer')
                .eq('company_id', companyId)
                .in('vehicle_id', vehicleIds)
                .lt('created_at', saoPauloStart(startDate))
                .order('odometer', { ascending: false });
            baselines?.forEach(b => {
                if (b.vehicle_id && !vehicleKmBaseline[b.vehicle_id]) {
                    vehicleKmBaseline[b.vehicle_id] = Number(b.odometer);
                }
            });
        }

        const fuelByVehicle: Record<string, any[]> = {};
        fuels?.forEach(f => {
            if (!f.vehicle_id) return;
            const vData: any = f.vehicle;
            if (!vehicleStats[f.vehicle_id]) {
                vehicleStats[f.vehicle_id] = { vehicle_id: f.vehicle_id, plate: vData?.plate || '---', model: vData?.model || '', liters: 0, fuelCost: 0, arlaCost: 0, kmDriven: 0, revenue: 0, lastOdometer: 0 };
            }
            if (!fuelByVehicle[f.vehicle_id]) fuelByVehicle[f.vehicle_id] = [];
            fuelByVehicle[f.vehicle_id].push(f);
        });

        Object.keys(fuelByVehicle).forEach(vId => {
            const records = fuelByVehicle[vId];
            let totalLiters = 0;
            let totalCost = 0;
            let totalKm = 0;
            let previousKm = vehicleKmBaseline[vId] || 0;

            let totalArlaCost = 0;
            records.forEach(r => {
                const liters = Number(r.liters) || 0;
                totalCost += Number(r.total_value) || 0;
                totalArlaCost += Number(r.arla_value) || 0;
                if (!isDieselFuel(r.fuel_type) || liters <= 0) return;
                totalLiters += liters;
                const currentKm = Number(r.odometer);
                if (previousKm > 0) {
                    const diff = currentKm - previousKm;
                    if (diff > 0 && diff < 15000) totalKm += diff;
                }
                previousKm = currentKm;
            });

            vehicleStats[vId].liters += totalLiters;
            vehicleStats[vId].fuelCost += totalCost;
            vehicleStats[vId].arlaCost += totalArlaCost;
            vehicleStats[vId].kmDriven += totalKm;
        });

        trips?.forEach(t => {
            if (!t.vehicle_id || !vehicleStats[t.vehicle_id]) return;
            vehicleStats[t.vehicle_id].revenue += Number(t.gross_value) || 0;
        });

        return Object.values(vehicleStats).map(v => ({
            vehicle_id: v.vehicle_id,
            vehicle: v.plate + (v.model ? ` — ${v.model}` : ''),
            plate: v.plate,
            revenue: v.revenue,
            fuelCost: v.fuelCost,
            arlaCost: v.arlaCost,
            totalFuelCost: v.fuelCost + v.arlaCost,
            kmPerLiter: v.liters > 0 && v.kmDriven > 0 ? v.kmDriven / v.liters : 0,
            costPerKm: v.kmDriven > 0 ? (v.fuelCost + v.arlaCost) / v.kmDriven : 0
        })).sort((a, b) => b.kmPerLiter - a.kmPerLiter);
    },

    async getCostDistribution(companyId: string, startDate?: string, endDate?: string) {
        let fuelQuery = supabase
           .from('fuel_records')
           .select('total_value, arla_value, created_at')
           .eq('company_id', companyId);

        let maintenanceQuery = supabase
           .from('maintenance')
           .select('cost, date')
           .eq('company_id', companyId);

        // Vales liquidados (status histórico inconsistente: settled | paid)
        let advancesQuery = supabase
           .from('driver_advances')
           .select('amount, created_at, status')
           .eq('company_id', companyId)
           .in('status', ['settled', 'paid']);

        // Comissão alinhada aos KPIs: viagens reais do período (não settlements órfãos)
        let tripsQuery = supabase
           .from('trips')
           .select('gross_value, commission_rate, tax_rate, icms_value, tolls_value, insurance_value, estimated_cost, loading_cost, unloading_cost, status')
           .eq('company_id', companyId)
           .in('status', ['completed', 'paid']);

        if (startDate) {
            fuelQuery = fuelQuery.gte('created_at', saoPauloStart(startDate));
            maintenanceQuery = maintenanceQuery.gte('date', startDate);
            advancesQuery = advancesQuery.gte('created_at', saoPauloStart(startDate));
            tripsQuery = tripsQuery.gte('created_at', saoPauloStart(startDate));
        }
        if (endDate) {
            fuelQuery = fuelQuery.lt('created_at', saoPauloEndExclusive(endDate));
            maintenanceQuery = maintenanceQuery.lte('date', endDate);
            advancesQuery = advancesQuery.lt('created_at', saoPauloEndExclusive(endDate));
            tripsQuery = tripsQuery.lt('created_at', saoPauloEndExclusive(endDate));
        }

        const [
            { data: fuel, error: fError },
            { data: maintenance, error: mError },
            { data: advances, error: aError },
            { data: trips, error: tError },
        ] = await Promise.all([
            fuelQuery,
            maintenanceQuery,
            advancesQuery,
            tripsQuery,
        ]);

        if (fError || mError || aError || tError) throw fError || mError || aError || tError;

        let commissionBase = normalizeCommissionBase('net_tax');
        try {
            const s = await settingsService.getSettings(companyId);
            commissionBase = normalizeCommissionBase(s?.commission_base);
        } catch { /* default */ }

        const fuelTotal = fuel?.reduce((acc, f) => acc + (Number(f.total_value) || 0), 0) || 0;
        const arlaTotal = fuel?.reduce((acc, f) => acc + (Number((f as any).arla_value) || 0), 0) || 0;
        const maintenanceTotal = maintenance?.reduce((acc, m) => acc + (Number((m as any).cost) || 0), 0) || 0;
        const advancesTotal = advances?.reduce((acc, a) => acc + (Number(a.amount) || 0), 0) || 0;
        const commissionsTotal = trips?.reduce((acc, t) => {
            return acc + calcTripCommission(t, commissionBase).commission;
        }, 0) || 0;
        const laborTotal = advancesTotal + commissionsTotal;

        const total = fuelTotal + arlaTotal + maintenanceTotal + laborTotal;
        if (total <= 0) return [];

        const items = [
           { label: 'Diesel', value: fuelTotal, percentage: (fuelTotal / total) * 100, color: '#2563EB' },
           { label: 'ARLA 32', value: arlaTotal, percentage: (arlaTotal / total) * 100, color: '#0D9488' },
           { label: 'Manutenção', value: maintenanceTotal, percentage: (maintenanceTotal / total) * 100, color: '#F43F5E' },
           { label: 'Pessoal', value: laborTotal, percentage: (laborTotal / total) * 100, color: '#10B981' },
        ];
        return items.filter(i => i.value > 0);
    }
};

export const supplierService = {
    async getSuppliers(companyId: string) {
        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .eq('company_id', companyId)
            .order('name', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async addSupplier(data: any) {
        const { id: _id, ...supplierData } = data;
        const { error } = await supabase
            .from('suppliers')
            .insert([supplierData]);

        if (error) throw error;
    },

    async updateSupplier(id: string, data: any) {
        const { error } = await supabase
            .from('suppliers')
            .update(data)
            .eq('id', id);

        if (error) throw error;
    },

    async deleteSupplier(id: string) {
        const { error } = await supabase
            .from('suppliers')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};

export const clientService = {
    async getClients(companyId: string, opts?: { activeOnly?: boolean }) {
        let q = supabase
            .from('clients')
            .select('*')
            .eq('company_id', companyId)
            .order('name', { ascending: true });
        if (opts?.activeOnly) q = q.eq('active', true);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
    },

    async addClient(data: any) {
        const { id: _id, ...clientData } = data;
        const { data: row, error } = await supabase
            .from('clients')
            .insert([{ ...clientData, active: clientData.active !== false }])
            .select()
            .single();
        if (error) throw error;
        return row;
    },

    async updateClient(id: string, data: any) {
        const { id: _id, company_id: _c, created_at: _ca, ...updates } = data;
        const { data: row, error } = await supabase
            .from('clients')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return row;
    },

    async deleteClient(id: string) {
        const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },
};

export const fixedRouteService = {
    async getFixedRoutes(companyId: string) {
        const { data, error } = await supabase
            .from('fixed_routes')
            .select('*')
            .eq('company_id', companyId)
            .order('origin', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async addFixedRoute(data: any) {
        const { error } = await supabase
            .from('fixed_routes')
            .insert([data]);

        if (error) throw error;
    },

    async updateFixedRoute(id: string, data: any) {
        const { error } = await supabase
            .from('fixed_routes')
            .update(data)
            .eq('id', id);

        if (error) throw error;
    },

    async deleteFixedRoute(id: string) {
        const { error } = await supabase
            .from('fixed_routes')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};

// ============================================================
// MASTER SERVICE — controle de assinaturas (uso exclusivo da página master)
// ============================================================
export const masterService = {
    /** Busca todas as empresas com sua assinatura para o painel master */
    async getAllCompaniesWithSubscriptions() {
        const { data, error } = await supabase
            .from('companies')
            .select(`
                id, name, phone, email, created_at,
                profiles(email, phone, role),
                subscription:subscriptions(
                    id, plan, status, mrr, vehicle_limit,
                    trial_ends_at, current_period_start, current_period_end,
                    overdue_since, blocked_at, canceled_at,
                    kiwify_customer_email, kiwify_subscription_id, checkout_url, block_reason
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[masterService] getAllCompaniesWithSubscriptions:', error.message, error.code, error.hint);
            throw error;
        }
        // Só empresas-cliente (pelo menos um admin). Ignora fantasma de frentista/equipe.
        return (data || [])
            .map((c: any) => {
                const profiles = Array.isArray(c.profiles) ? c.profiles : (c.profiles ? [c.profiles] : []);
                const adminProfile =
                    profiles.find((p: any) => p.role === 'admin' && (p.email || p.phone))
                    || profiles.find((p: any) => p.role === 'admin')
                    || null;
                const contactPhone = c.phone || adminProfile?.phone || null;
                return {
                    ...c,
                    profiles,
                    hasAdmin: profiles.some((p: any) => p.role === 'admin'),
                    adminEmail: adminProfile?.email || null,
                    adminPhone: contactPhone,
                    contactPhone,
                    subscription: Array.isArray(c.subscription) ? c.subscription[0] : c.subscription
                };
            })
            .filter((c: any) => c.hasAdmin);
    },

    /** Busca KPIs do master: MRR total, counts por status (só empresas com admin). */
    async getMasterKpis() {
        const companies = await this.getAllCompaniesWithSubscriptions();
        const subs = companies.map((c: any) => c.subscription).filter(Boolean);
        const active   = subs.filter((s: any) => s.status === 'active');
        const overdue  = subs.filter((s: any) => s.status === 'overdue');
        const trial    = subs.filter((s: any) => s.status === 'trial');
        const canceled = subs.filter((s: any) => s.status === 'canceled' || s.status === 'blocked');

        const totalMRR     = active.reduce((sum: number, s: any) => sum + (Number(s.mrr) || 0), 0);
        const overdueValue = overdue.reduce((sum: number, s: any) => sum + (Number(s.mrr) || 0), 0);

        return {
            totalMRR,
            overdueValue,
            activeCount:   active.length,
            overdueCount:  overdue.length,
            trialCount:    trial.length,
            canceledCount: canceled.length,
            totalCount:    companies.length,
        };
    },

    /** Bloqueia manualmente uma empresa (master) */
    async blockCompany(companyId: string, reason: string = '') {
        const { error } = await supabase
            .from('subscriptions')
            .update({
                status: 'blocked',
                blocked_at: new Date().toISOString(),
                block_reason: reason || 'Bloqueado manualmente pelo administrador.',
            })
            .eq('company_id', companyId);

        if (error) throw error;
    },

    /** Desbloqueia uma empresa (master) */
    async unblockCompany(companyId: string) {
        const { error } = await supabase
            .from('subscriptions')
            .update({
                status: 'active',
                blocked_at: null,
                block_reason: null,
            })
            .eq('company_id', companyId);

        if (error) throw error;
    },

    /** Estende manualmente a assinatura por N dias */
    async extendSubscription(companyId: string, days: number) {
        const { data: sub } = await supabase
            .from('subscriptions')
            .select('current_period_end, trial_ends_at')
            .eq('company_id', companyId)
            .maybeSingle();

        const base = sub?.current_period_end
            ? new Date(sub.current_period_end)
            : (sub?.trial_ends_at ? new Date(sub.trial_ends_at) : new Date());

        const newEnd = new Date(base.getTime() + days * 86400000);

        const { error } = await supabase
            .from('subscriptions')
            .update({
                status: 'active',
                current_period_end: newEnd.toISOString(),
                overdue_since: null,
                blocked_at: null,
            })
            .eq('company_id', companyId);

        if (error) throw error;
    },

    /** Define a URL de checkout Kiwify de uma empresa */
    async setCheckoutUrl(companyId: string, url: string) {
        const { error } = await supabase
            .from('subscriptions')
            .update({ checkout_url: url })
            .eq('company_id', companyId);

        if (error) throw error;
    },

    /** Busca subscription de uma empresa específica (uso no guard) */
    async getCompanySubscription(companyId: string) {
        const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('company_id', companyId)
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    /** Altera o plano de uma empresa (master) */
    async changePlan(companyId: string, plan: string) {
        const limitMap: Record<string, number | null> = {
            basico: 5,
            pro: 20,
            enterprise: null,   // null = ilimitado
        };
        const mrrMap: Record<string, number> = {
            basico: 197,
            pro: 297,
            enterprise: 497,
        };
        const { error } = await supabase
            .from('subscriptions')
            .update({
                plan,
                status: 'active',
                vehicle_limit: Object.prototype.hasOwnProperty.call(limitMap, plan) ? limitMap[plan] : 5,
                mrr: mrrMap[plan] ?? 0,
                current_period_start: new Date().toISOString(),
                overdue_since: null,
                blocked_at: null,
                canceled_at: null,
            })
            .eq('company_id', companyId);

        if (error) throw error;
    },
};

export const agregadoService = {
    async getAll(companyId: string) {
        if (!companyId) return [];
        const { data, error } = await supabase
            .from('agregados')
            .select('*')
            .eq('company_id', companyId)
            .order('name', { ascending: true });
        if (error) throw error;
        return data ?? [];
    },
    async add(payload: any) {
        const { id: _id, ...data } = payload;
        const { data: created, error } = await supabase
            .from('agregados')
            .insert([data])
            .select()
            .single();
        if (error) throw error;
        if (created?.company_id) {
            try { await fleetService.ensureAgregadoVehicles(created.company_id); } catch { /* posto/abastecimento sincroniza de novo */ }
        }
        return created;
    },
    async update(id: string, updates: any) {
        const { data, error } = await supabase
            .from('agregados')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        if (data?.company_id) {
            try { await fleetService.ensureAgregadoVehicles(data.company_id); } catch { /* posto/abastecimento sincroniza de novo */ }
        }
        return data;
    },
    async remove(id: string) {
        const { error } = await supabase
            .from('agregados')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // Liquida uma viagem de agregado:
    // - Cria contas a pagar pelo valor do frete repassado
    // - Lança lucro líquido como receita no financeiro
    // - Marca viagem como 'paid'
    async settleAgregadoTrip(trip: any, companyId: string) {
        const gross    = Number(trip.gross_value) || 0;
        const taxRate  = Number(trip.tax_rate) || 0;
        const agrValue = Number(trip.agregado_value) || 0;
        const netProfit = Math.round((gross * (1 - taxRate / 100) - agrValue) * 100) / 100;
        const today = new Date().toISOString().split('T')[0];

        // 1. Conta a pagar para o agregado
        await supabase.from('accounts_payable').insert([{
            company_id: companyId,
            description: `Frete agregado: ${trip.origin ?? ''} → ${trip.destination ?? ''}`,
            amount: agrValue,
            due_date: today,
            status: 'pending',
            supplier_name: trip.agregado?.name ?? 'Agregado',
            notes: `Viagem ID: ${trip.id}`,
        }]);

        // 2. Lançamento de receita (lucro líquido da operação)
        if (netProfit > 0) {
            await supabase.from('financial_transactions').insert([{
                company_id: companyId,
                type: 'receita',
                description: `Lucro agregado: ${trip.origin ?? ''} → ${trip.destination ?? ''}`,
                amount: netProfit,
                competence_date: today,
                payment_date: today,
                status: 'paid',
                trip_id: trip.id,
            }]);
        }

        // 3. Marcar viagem como paga
        const { error } = await supabase
            .from('trips')
            .update({ status: 'paid' })
            .eq('id', trip.id);
        if (error) throw error;
    },
};
