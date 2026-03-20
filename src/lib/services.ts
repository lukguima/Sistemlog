import { supabase } from './supabase';

export const fleetService = {
    async getVehicles(companyId: string) {
        if (!companyId) return [];
        const { data, error } = await supabase
            .from('vehicles')
            .select('*')
            .eq('company_id', companyId);
        if (error) throw error;
        return data;
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
    async deleteVehicle(id: string) {
        const { error } = await supabase
            .from('vehicles')
            .delete()
            .eq('id', id);
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
    async getTrips(companyId: string, startDate?: string, endDate?: string) {
        let query = supabase
            .from('trips')
            .select('*, vehicle:vehicles(plate), driver:drivers(name)')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (startDate) query = query.gte('created_at', startDate);
        if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`);

        const { data, error } = await query;
        if (error) throw error;
        return data;
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
    async checkConflicts(driverId: string | null, vehicleId: string | null, excludeTripId?: string): Promise<{ driverBusy: boolean; vehicleBusy: boolean; driverTrip: any; vehicleTrip: any }> {
        const ACTIVE = ['pending', 'in_transit'];
        const [driverRes, vehicleRes] = await Promise.all([
            driverId
                ? supabase.from('trips').select('id, from_city, to_city, created_at, vehicle:vehicles(plate)').eq('driver_id', driverId).in('status', ACTIVE).neq('id', excludeTripId || '00000000-0000-0000-0000-000000000000').limit(1).maybeSingle()
                : Promise.resolve({ data: null, error: null }),
            vehicleId
                ? supabase.from('trips').select('id, from_city, to_city, created_at, driver:drivers(name)').eq('vehicle_id', vehicleId).in('status', ACTIVE).neq('id', excludeTripId || '00000000-0000-0000-0000-000000000000').limit(1).maybeSingle()
                : Promise.resolve({ data: null, error: null }),
        ]);
        return {
            driverBusy: !!driverRes.data,
            vehicleBusy: !!vehicleRes.data,
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
            .select('*, vehicle:vehicles(plate, current_km)')
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
        const { data, error } = await supabase
            .from('trips')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },
    async deleteTrip(id: string) {
        const { error } = await supabase
            .from('trips')
            .delete()
            .eq('id', id);
        if (error) throw error;
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
                .select('gross_value, commission_rate, tax_rate')
                .in('id', tripIds);
            if (tErr || !trips) continue;

            const round2 = (n: number) => Math.round(n * 100) / 100;

            const totalGross = trips.reduce((acc, t) => acc + (Number(t.gross_value) || 0), 0);
            const totalCommission = trips.reduce((acc, t) => {
                const gross = Number(t.gross_value) || 0;
                const tax = Number(t.tax_rate) || 0;
                const rate = Number(t.commission_rate) || 12;
                const netBase = gross * (1 - tax / 100);
                return acc + round2(netBase * rate / 100);
            }, 0);

            const netPaid = round2(Math.max(0, totalCommission - (Number(settlement.total_advances_applied) || 0) - (Number(settlement.total_trip_discounts) || 0)));

            await supabase
                .from('settlements')
                .update({ total_gross: totalGross, net_paid: netPaid })
                .eq('id', settlement.id);
        }
    }
};

export const financeService = {
    async getKpis(companyId: string, startDate?: string, endDate?: string) {
        let tripQuery = supabase
            .from('trips')
            .select('gross_value, status, tolls_value, insurance_value')
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

        if (startDate) {
            tripQuery = tripQuery.gte('created_at', startDate);
            fuelQuery = fuelQuery.gte('created_at', startDate);
            maintenanceQuery = maintenanceQuery.gte('date', startDate);
        }
        if (endDate) {
            tripQuery = tripQuery.lte('created_at', `${endDate}T23:59:59.999Z`);
            fuelQuery = fuelQuery.lte('created_at', `${endDate}T23:59:59.999Z`);
            maintenanceQuery = maintenanceQuery.lte('date', `${endDate}T23:59:59.999Z`);
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
        
        // Custos de Viagem (Pedágio e Seguro por viagem)
        const tripTolls = trips?.reduce((acc, trip) => acc + (Number((trip as any).tolls_value) || 0), 0) || 0;
        const tripInsurance = trips?.reduce((acc, trip) => acc + (Number((trip as any).insurance_value) || 0), 0) || 0;
        
        // Custos Fixos de Veículo (Seguro fixo - escalonado pelo período se necessário, mas aqui somaremos o total cadastrado)
        const fixedInsurance = vehicles?.reduce((acc, vehicle) => acc + (Number((vehicle as any).insurance_value) || 0), 0) || 0;

        const totalExpenses = fuelExpenses + arlaExpenses + maintenanceExpenses + tripTolls + tripInsurance + fixedInsurance;

        return {
            grossRevenue,
            expectedGrossRevenue,
            fuelExpenses,
            arlaExpenses,
            maintenanceExpenses,
            tripTolls,
            tripInsurance,
            fixedInsurance,
            totalExpenses,
            netRevenue: grossRevenue - totalExpenses,
            expectedNetRevenue: expectedGrossRevenue
        };
    },
    async getMonthlyFinancials(companyId: string) {
        const today = new Date();
        const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString();

        const { data: trips, error: tError } = await supabase
            .from('trips')
            .select('gross_value, created_at')
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
                // Deduzir pedágio e seguro da receita ou adicionar às despesas? 
                // Colocaremos como despesas mensais para clareza
                result[key].expenses += (Number((t as any).tolls_value) || 0) + (Number((t as any).insurance_value) || 0);
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

        if (startDate) query = query.gte('date', startDate);
        if (endDate) query = query.lte('date', `${endDate}T23:59:59.999Z`);

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },
    async addMaintenance(maintenance: any) {
        const { id: _id, ...maintenanceData } = maintenance;
        const { data, error } = await supabase
            .from('maintenance')
            .insert([maintenanceData])
            .select()
            .single();
        if (error) throw error;

        if (maintenance.km || maintenance.current_km) {
            const km = maintenance.km || maintenance.current_km;
            await supabase
                .from('vehicles')
                .update({ current_km: km })
                .eq('id', maintenance.vehicle_id);
        }
        return data;
    },
    async updateMaintenance(id: string, updates: any) {
        const { data, error } = await supabase
            .from('maintenance')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },
    async deleteMaintenance(id: string) {
        const { error } = await supabase
            .from('maintenance')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};

export const driverService = {
    async addFuelRecord(record: any) {
        // Impede duplicata: mesmo veículo + mesmo odômetro + mesma empresa
        if (record.vehicle_id && record.odometer && record.company_id) {
            const { data: dup } = await supabase
                .from('fuel_records')
                .select('id')
                .eq('vehicle_id', record.vehicle_id)
                .eq('odometer', record.odometer)
                .eq('company_id', record.company_id)
                .limit(1)
                .maybeSingle();
            if (dup) throw new Error(`Já existe um abastecimento registrado para este veículo com hodômetro ${record.odometer} km.`);
        }
        const { data, error } = await supabase
            .from('fuel_records')
            .insert([record])
            .select()
            .single();
        if (error) throw error;
        return data;
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
    async getFuelRecords(companyId: string, startDate?: string, endDate?: string) {
        let query = supabase
            .from('fuel_records')
            .select('*, vehicle:vehicles(plate), driver:drivers(name)')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (startDate) query = query.gte('created_at', startDate);
        if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`);

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },
    async updateFuelRecord(id: string, updates: any) {
        const { data, error } = await supabase
            .from('fuel_records')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },
    async deleteFuelRecord(id: string) {
        const { error } = await supabase
            .from('fuel_records')
            .delete()
            .eq('id', id);
        if (error) throw error;
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
        const { data, error } = await supabase
            .from('settings')
            .select('*')
            .eq('company_id', companyId)
            .maybeSingle();
        if (error) throw error; 
        return data;
    },
    async saveSettings(settings: any) {
        // Mapear active_modules do frontend para modules do banco
        const dbSettings = {
            ...settings,
            modules: settings.active_modules || settings.modules
        };
        // Remover active_modules para não dar erro de coluna inexistente
        delete (dbSettings as any).active_modules;

        const { data, error } = await supabase
            .from('settings')
            .upsert(dbSettings)
            .select()
            .single();
        if (error) throw error;
        return data;
    },
    async getCompanyProfile(companyId: string) {
        const { data, error } = await supabase
            .from('companies') // Caso a tabela exista, senão buscar do settings ou profiles
            .select('*')
            .eq('id', companyId)
            .maybeSingle();
        
        // Fallback: se não houver tabela 'companies', retornar dados básicos do profile/settings
        if (error || !data) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, company_name')
                .eq('company_id', companyId)
                .limit(1)
                .maybeSingle();
            return { company_name: profile?.company_name || '' };
        }
        return data;
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

// URLs de checkout Kiwify por plano.
// Configure aqui os links gerados no painel Kiwify (Produtos > Copiar link de compra).
export const KIWIFY_CHECKOUT_URLS: Record<string, string> = {
    basico:    'https://pay.kiwify.com.br/Xo5neXV',
    pro:       'https://pay.kiwify.com.br/9f3rjhC',
    enterprise:'https://pay.kiwify.com.br/itrSZqN',
};

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
    createKiwifyCheckout(plan: string): string {
        const url = KIWIFY_CHECKOUT_URLS[plan.toLowerCase()];
        if (!url) throw new Error(`Plano "${plan}" não encontrado. Configure KIWIFY_CHECKOUT_URLS em services.ts.`);
        return url;
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
        let tripQuery = supabase
            .from('trips')
            .select('vehicle_id, gross_value, created_at, vehicle:vehicles(plate)')
            .eq('company_id', companyId);

        let fuelQuery = supabase
            .from('fuel_records')
            .select('vehicle_id, total_value, arla_value, created_at, vehicle:vehicles(plate)')
            .eq('company_id', companyId);

        if (startDate) {
            tripQuery = tripQuery.gte('created_at', startDate);
            fuelQuery = fuelQuery.gte('created_at', startDate);
        }
        if (endDate) {
            tripQuery = tripQuery.lte('created_at', endDate);
            fuelQuery = fuelQuery.lte('created_at', endDate);
        }

        const [{ data: trips, error: tError }, { data: fuels, error: fError }] = await Promise.all([
            tripQuery,
            fuelQuery
        ]);

        if (tError || fError) throw tError || fError;

        const profitByTruck: Record<string, { plate: string; gross: number; expenses: number; net: number }> = {};

        trips?.forEach(t => {
            const vId = t.vehicle_id;
            if (!vId) return;
            if (!profitByTruck[vId]) {
                const vehicleData: any = t.vehicle;
                profitByTruck[vId] = { plate: vehicleData?.plate || '---', gross: 0, expenses: 0, net: 0 };
            }
            profitByTruck[vId].gross += Number(t.gross_value) || 0;
            profitByTruck[vId].expenses += (Number((t as any).tolls_value) || 0) + (Number((t as any).insurance_value) || 0);
        });

        fuels?.forEach(f => {
            const vId = f.vehicle_id;
            if (!vId) return;
            if (!profitByTruck[vId]) {
                const vehicleData: any = f.vehicle;
                profitByTruck[vId] = { plate: vehicleData?.plate || '---', gross: 0, expenses: 0, net: 0 };
            }
            profitByTruck[vId].expenses += (Number(f.total_value) || 0) + (Number((f as any).arla_value) || 0);
        });

        Object.values(profitByTruck).forEach(truck => {
            truck.net = truck.gross - truck.expenses;
        });

        return Object.values(profitByTruck).sort((a, b) => b.net - a.net);
    },

    async getVehicleAnalytics(companyId: string, vehicleId: string) {
        if (!companyId || !vehicleId) throw new Error("ID da empresa ou do veículo não informado.");

        const [
            { data: vehicle, error: vError },
            { data: trips, error: tError },
            { data: fuels, error: fError },
            { data: maintenances, error: mError }
        ] = await Promise.all([
            supabase.from('vehicles').select('*').eq('id', vehicleId).single(),
            supabase.from('trips').select('*, driver:drivers(name)').eq('vehicle_id', vehicleId).order('created_at', { ascending: false }),
            supabase.from('fuel_records').select('*, driver:drivers(name)').eq('vehicle_id', vehicleId).order('created_at', { ascending: false }),
            supabase.from('maintenance').select('*').eq('vehicle_id', vehicleId).order('date', { ascending: false })
        ]);

        if (vError || tError || fError || mError) throw vError || tError || fError || mError;

        // Calcular estatísticas
        const totalGross = trips?.reduce((acc, t) => acc + (Number(t.gross_value) || 0), 0) || 0;
        const totalFuel = fuels?.reduce((acc, f) => acc + (Number(f.total_value) || 0), 0) || 0;
        const totalMaint = maintenances?.reduce((acc, m) => acc + (Number((m as any).cost) || 0), 0) || 0;
        const totalTolls = trips?.reduce((acc, t) => acc + (Number((t as any).tolls_value) || 0), 0) || 0;
        
        const totalExpenses = totalFuel + totalMaint + totalTolls;
        const netProfit = totalGross - totalExpenses;

        // Calcular médias de consumo
        let avgKmPerLiter = 0;
        if (fuels && fuels.length > 1) {
            const sortedFuels = [...fuels].sort((a, b) => Number(a.odometer) - Number(b.odometer));
            const rangeKm = Number(sortedFuels[sortedFuels.length - 1].odometer) - Number(sortedFuels[0].odometer);
            const totalLiters = sortedFuels.slice(1).reduce((acc, f) => acc + (Number(f.liters) || 0), 0);
            if (totalLiters > 0) avgKmPerLiter = rangeKm / totalLiters;
        }

        return {
            vehicle,
            stats: {
                totalGross,
                totalExpenses,
                netProfit,
                avgKmPerLiter,
                totalMaint,
                totalFuel,
                totalTolls
            },
            history: {
                trips: trips?.slice(0, 10) || [],
                fuels: fuels?.slice(0, 10) || [],
                maintenances: maintenances?.slice(0, 10) || []
            }
        };
    },

    async getDriverAverages(companyId: string, startDate?: string, endDate?: string) {
        let query = supabase
            .from('fuel_records')
            .select('driver_id, vehicle_id, odometer, liters, created_at, driver:drivers(name)')
            .eq('company_id', companyId)
            .order('odometer', { ascending: true });

        if (startDate) query = query.gte('created_at', startDate);
        if (endDate) query = query.lte('created_at', endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`);

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
                .lt('created_at', startDate)
                .order('odometer', { ascending: false });
            
            baselines?.forEach(b => {
                if (b.vehicle_id && !vehicleKm[b.vehicle_id]) {
                    vehicleKm[b.vehicle_id] = Number(b.odometer);
                }
            });
        }

        fuels?.forEach(f => {
            if (!f.driver_id || !f.vehicle_id) return;
            
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
        
        // 1. Veículos (Manutenção e Documentos)
        const { data: vehicles, error: vError } = await supabase
            .from('vehicles')
            .select('id, plate, current_km, document_expiry, antt_expiry')
            .eq('company_id', companyId);

        if (vError) throw vError;

        const { data: maintenances, error: mError } = await supabase
            .from('maintenance')
            .select('vehicle_id, preventive_type, next_maintenance_km, maintenance_interval')
            .eq('company_id', companyId)
            .not('next_maintenance_km', 'is', null)
            .order('date', { ascending: false });

        if (mError) throw mError;

        // 2. Motoristas (Documentos)
        const { data: drivers, error: dError } = await supabase
            .from('drivers')
            .select('id, name, license_expiry')
            .eq('company_id', companyId);

        if (dError) throw dError;

        // 3. Pneus (TWI Crítico)
        const { data: tyres, error: tError } = await supabase
            .from('tyres')
            .select('id, vehicle_id, position, tread_depth_mm, brand')
            .eq('company_id', companyId)
            .lte('tread_depth_mm', 1.6);

        if (tError) throw tError;

        const lastMaintenances: Record<string, any> = {};
        maintenances?.forEach(m => {
            const key = `${m.vehicle_id}-${m.preventive_type}`;
            if (!lastMaintenances[key]) lastMaintenances[key] = m;
        });

        vehicles?.forEach(v => {
            // Alertas de Manutenção
            const vehicleMaintenances = Object.values(lastMaintenances).filter((m: any) => m.vehicle_id === v.id);
            vehicleMaintenances.forEach((m: any) => {
                const currentKm = Number(v.current_km);
                const nextKm = Number(m.next_maintenance_km);
                const interval = Number(m.maintenance_interval) || 10000; 
                const remaining = nextKm - currentKm;
                const threshold = interval * 0.1; 

                if (remaining <= threshold && remaining > -interval) {
                    const severity = remaining <= 0 ? 'critical' : 'warning';
                    const typeLabel = m.preventive_type === 'oleo' ? 'Troca de Óleo' :
                                    m.preventive_type === 'filtros' ? 'Troca de Filtros' :
                                    m.preventive_type === 'freios' ? 'Revisão de Freios' :
                                    m.preventive_type === 'correias' ? 'Troca de Correias' :
                                    m.preventive_type === 'revisao_geral' ? 'Revisão Geral' : 'Manutenção';

                    alerts.push({
                        id: `maint-${v.id}-${m.preventive_type}`,
                        type: 'Maintenance',
                        title: `${typeLabel} - ${v.plate}`,
                        message: remaining <= 0 
                            ? `ATENÇÃO: Quilometragem atingida (${currentKm.toLocaleString()}km). Realize a manutenção imediatamente.`
                            : `Faltam apenas ${remaining.toLocaleString()}km para a ${typeLabel.toLowerCase()}.`,
                        severity,
                        date: new Date().toISOString()
                    });
                }
            });

            // Alertas de Documentos do Veículo (CRLV/Licenciamento)
            if (v.document_expiry) {
                const expiry = new Date(v.document_expiry);
                if (expiry <= thirtyDaysFromNow) {
                    alerts.push({
                        id: `doc-v-${v.id}`,
                        type: 'Document',
                        title: `Licenciamento - ${v.plate}`,
                        message: expiry <= today 
                            ? `CRITICAL: Licenciamento vencido em ${expiry.toLocaleDateString('pt-BR')}.`
                            : `Licenciamento vence em ${expiry.toLocaleDateString('pt-BR')}.`,
                        severity: expiry <= today ? 'critical' : 'warning',
                        date: new Date().toISOString()
                    });
                }
            }

            // Alertas de ANTT
            if (v.antt_expiry) {
                const expiry = new Date(v.antt_expiry);
                if (expiry <= thirtyDaysFromNow) {
                    alerts.push({
                        id: `antt-v-${v.id}`,
                        type: 'Document',
                        title: `ANTT - ${v.plate}`,
                        message: expiry <= today 
                            ? `CRITICAL: Registro ANTT vencido em ${expiry.toLocaleDateString('pt-BR')}.`
                            : `Registro ANTT vence em ${expiry.toLocaleDateString('pt-BR')}.`,
                        severity: expiry <= today ? 'critical' : 'warning',
                        date: new Date().toISOString()
                    });
                }
            }
        });

        // Alertas de Documentos de Motoristas (CNH)
        drivers?.forEach(d => {
            if (d.license_expiry) {
                const expiry = new Date(d.license_expiry);
                if (expiry <= thirtyDaysFromNow) {
                    alerts.push({
                        id: `doc-d-${d.id}`,
                        type: 'Document',
                        title: `CNH - ${d.name}`,
                        message: expiry <= today 
                            ? `CRITICAL: CNH vencida em ${expiry.toLocaleDateString('pt-BR')}.`
                            : `CNH vence em ${expiry.toLocaleDateString('pt-BR')}.`,
                        severity: expiry <= today ? 'critical' : 'warning',
                        date: new Date().toISOString()
                    });
                }
            }
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
            .select('driver_id, vehicle_id, gross_value, created_at, driver:drivers(name), vehicle:vehicles(plate)')
            .eq('company_id', companyId);

        // Busca abastecimentos agrupados por veículo para calcular KM/L do veículo
        let fuelQuery = supabase
            .from('fuel_records')
            .select('vehicle_id, liters, odometer, created_at')
            .eq('company_id', companyId)
            .order('odometer', { ascending: true });

        if (startDate) {
            tripQuery = tripQuery.gte('created_at', startDate);
            fuelQuery = fuelQuery.gte('created_at', startDate);
        }
        if (endDate) {
            tripQuery = tripQuery.lte('created_at', endDate);
            fuelQuery = fuelQuery.lte('created_at', endDate);
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
                const currentKm = Number(r.odometer);
                totalLiters += Number(r.liters) || 0;
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
            .select('vehicle_id, total_value, arla_value, liters, created_at, odometer, vehicle:vehicles(plate, model)')
            .eq('company_id', companyId)
            .order('odometer', { ascending: true });

        let tripQuery = supabase
            .from('trips')
            .select('vehicle_id, gross_value, created_at')
            .eq('company_id', companyId);

        if (startDate) {
            fuelQuery = fuelQuery.gte('created_at', startDate);
            tripQuery = tripQuery.gte('created_at', startDate);
        }
        if (endDate) {
            fuelQuery = fuelQuery.lte('created_at', endDate);
            tripQuery = tripQuery.lte('created_at', endDate);
        }

        const [{ data: fuels, error: fError }, { data: trips, error: tError }] = await Promise.all([fuelQuery, tripQuery]);
        if (fError || tError) throw fError || tError;

        const vehicleStats: Record<string, { plate: string; model: string; liters: number; fuelCost: number; arlaCost: number; kmDriven: number; revenue: number; lastOdometer: number }> = {};

        const vehicleKmBaseline: Record<string, number> = {};
        if (startDate && fuels && fuels.length > 0) {
            const vehicleIds = [...new Set(fuels.map(f => f.vehicle_id).filter(Boolean))];
            const { data: baselines } = await supabase
                .from('fuel_records')
                .select('vehicle_id, odometer')
                .eq('company_id', companyId)
                .in('vehicle_id', vehicleIds)
                .lt('created_at', startDate)
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
                vehicleStats[f.vehicle_id] = { plate: vData?.plate || '---', model: vData?.model || '', liters: 0, fuelCost: 0, arlaCost: 0, kmDriven: 0, revenue: 0, lastOdometer: 0 };
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
                totalLiters += Number(r.liters) || 0;
                totalCost += Number(r.total_value) || 0;
                totalArlaCost += Number(r.arla_value) || 0;
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
       
        let advancesQuery = supabase
           .from('driver_advances')
           .select('amount, created_at')
           .eq('company_id', companyId)
           .eq('status', 'paid');

        let settlementsQuery = supabase
           .from('settlements')
           .select('net_paid, settlement_date')
           .eq('company_id', companyId)
           .eq('status', 'paid');

        if (startDate) {
            fuelQuery = fuelQuery.gte('created_at', startDate);
            maintenanceQuery = maintenanceQuery.gte('date', startDate);
            advancesQuery = advancesQuery.gte('created_at', startDate);
            settlementsQuery = settlementsQuery.gte('settlement_date', startDate);
        }
        if (endDate) {
            fuelQuery = fuelQuery.lte('created_at', endDate);
            maintenanceQuery = maintenanceQuery.lte('date', endDate);
            advancesQuery = advancesQuery.lte('created_at', endDate);
            settlementsQuery = settlementsQuery.lte('settlement_date', endDate);
        }

        const [{ data: fuel, error: fError }, { data: maintenance, error: mError }, { data: advances, error: aError }, { data: settlements }] = await Promise.all([
            fuelQuery,
            maintenanceQuery,
            advancesQuery,
            settlementsQuery
        ]);

        if (fError || mError || aError) throw fError || mError || aError;
        const fuelTotal = fuel?.reduce((acc, f) => acc + (Number(f.total_value) || 0), 0) || 0;
        const arlaTotal = fuel?.reduce((acc, f) => acc + (Number((f as any).arla_value) || 0), 0) || 0;
        const maintenanceTotal = maintenance?.reduce((acc, m) => acc + (Number((m as any).cost) || 0), 0) || 0;
        const advancesTotal = advances?.reduce((acc, a) => acc + (Number(a.amount) || 0), 0) || 0;
        const commissionsTotal = settlements?.reduce((acc, s) => acc + (Number(s.net_paid) || 0), 0) || 0;
        const laborTotal = advancesTotal + commissionsTotal;

        const total = fuelTotal + arlaTotal + maintenanceTotal + laborTotal;

        const items = [
           { label: 'Diesel', value: fuelTotal, percentage: total ? (fuelTotal / total) * 100 : 0, color: '#2563EB' },
           { label: 'ARLA 32', value: arlaTotal, percentage: total ? (arlaTotal / total) * 100 : 0, color: '#0D9488' },
           { label: 'Manutenção', value: maintenanceTotal, percentage: total ? (maintenanceTotal / total) * 100 : 0, color: '#F43F5E' },
           { label: 'Pessoal', value: laborTotal, percentage: total ? (laborTotal / total) * 100 : 0, color: '#10B981' },
        ];
        // Omite ARLA do gráfico se não houver lançamentos de ARLA
        return arlaTotal > 0 ? items : items.filter(i => i.label !== 'ARLA 32');
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
                id, name, created_at,
                admin:profiles(email, phone),
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
        return (data || []).map((c: any) => {
            const admins = Array.isArray(c.admin) ? c.admin : (c.admin ? [c.admin] : []);
            const adminProfile = admins.find((p: any) => p.email) || admins[0] || null;
            return {
                ...c,
                adminEmail: adminProfile?.email || null,
                adminPhone: adminProfile?.phone || null,
                subscription: Array.isArray(c.subscription) ? c.subscription[0] : c.subscription
            };
        });
    },

    /** Busca KPIs do master: MRR total, counts por status */
    async getMasterKpis() {
        const { data, error } = await supabase
            .from('subscriptions')
            .select('status, mrr, plan');

        if (error) {
            console.error('[masterService] getMasterKpis:', error.message, error.code, error.hint);
            throw error;
        }

        const subs = data || [];
        const active   = subs.filter(s => s.status === 'active');
        const overdue  = subs.filter(s => s.status === 'overdue');
        const trial    = subs.filter(s => s.status === 'trial');
        const canceled = subs.filter(s => s.status === 'canceled' || s.status === 'blocked');

        const totalMRR     = active.reduce((sum, s) => sum + (Number(s.mrr) || 0), 0);
        const overdueValue = overdue.reduce((sum, s) => sum + (Number(s.mrr) || 0), 0);

        return {
            totalMRR,
            overdueValue,
            activeCount:   active.length,
            overdueCount:  overdue.length,
            trialCount:    trial.length,
            canceledCount: canceled.length,
            totalCount:    subs.length,
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
            enterprise: 397,
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
