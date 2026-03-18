import { useState, useEffect } from 'react';
import { Users, Plus, Search, Filter, Edit2, Trash2, MapPin, Phone, Mail, Tag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supplierService } from '../../lib/services';
import SupplierModal from '../../components/admin/SupplierModal';

export default function Suppliers() {
    const { user } = useAuth();
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('Todos');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<any>(null);

    const companyId = (user as any)?.company_id;

    useEffect(() => {
        if (companyId) {
            loadSuppliers();
        }
    }, [companyId]);

    async function loadSuppliers() {
        try {
            setLoading(true);
            const data = await supplierService.getSuppliers(companyId);
            setSuppliers(data);
        } catch (error) {
            console.error('Error loading suppliers:', error);
        } finally {
            setLoading(false);
        }
    }

    const filteredSuppliers = suppliers.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (s.document && s.document.includes(searchTerm));
        const matchesCategory = filterCategory === 'Todos' || s.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    const categories = ['Todos', 'Peças', 'Combustível', 'Oficina', 'Outros'];

    async function handleDelete(id: string) {
        if (window.confirm('Tem certeza que deseja excluir este fornecedor?')) {
            try {
                await supplierService.deleteSupplier(id);
                loadSuppliers();
            } catch (error) {
                console.error('Error deleting supplier:', error);
            }
        }
    }

    return (
        <div className="p-6 md:p-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Users className="text-primary-500" />
                        Cadastro de Fornecedores
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">Gerencie seus parceiros e fornecedores de serviços</p>
                </div>
                <button
                    onClick={() => {
                        setSelectedSupplier(null);
                        setIsModalOpen(true);
                    }}
                    className="btn-primary flex items-center gap-2 w-full md:w-auto justify-center"
                >
                    <Plus size={20} /> Novo Fornecedor
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou CNPJ/CPF..."
                        className="input-field pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <select
                        className="input-field pl-10"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        {categories.map(c => (
                            <option key={c} value={c}>{c === 'Todos' ? 'Todas Categorias' : c}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-12 text-center text-slate-500">Carregando fornecedores...</div>
                ) : filteredSuppliers.length > 0 ? (
                    filteredSuppliers.map((supplier) => (
                        <div key={supplier.id} className="card p-6 flex flex-col justify-between group hover:border-primary/50 transition-colors">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                                        ${supplier.category === 'Combustível' ? 'bg-orange-100 text-orange-600' :
                                          supplier.category === 'Peças' ? 'bg-blue-100 text-blue-600' :
                                          supplier.category === 'Oficina' ? 'bg-emerald-100 text-emerald-600' :
                                          'bg-slate-100 text-slate-600'}`}>
                                        {supplier.category}
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => {
                                                setSelectedSupplier(supplier);
                                                setIsModalOpen(true);
                                            }}
                                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(supplier.id)}
                                            className="p-2 hover:bg-red-50 text-red-500 rounded-lg"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{supplier.name}</h3>
                                <div className="space-y-2">
                                    {supplier.document && (
                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                            <Tag size={14} /> {supplier.document}
                                        </div>
                                    )}
                                    {supplier.phone && (
                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                            <Phone size={14} /> {supplier.phone}
                                        </div>
                                    )}
                                    {supplier.email && (
                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                            <Mail size={14} /> {supplier.email}
                                        </div>
                                    )}
                                    {(supplier.city || supplier.state) && (
                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                            <MapPin size={14} /> {supplier.city}{supplier.state ? ` - ${supplier.state}` : ''}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full py-12 text-center text-slate-500 italic">
                        Nenhum fornecedor encontrado.
                    </div>
                )}
            </div>

            <SupplierModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={loadSuppliers}
                supplier={selectedSupplier}
            />
        </div>
    );
}
