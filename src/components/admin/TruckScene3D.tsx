import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Float, Text } from '@react-three/drei';
import { Suspense, useEffect } from 'react';

// Configurações de layout para cada tipo de caminhão
const TRUCK_LAYOUTS: Record<string, any> = {
    UTILITARIO: {
        chassisLength: 4.0,
        axles: [
            { id: 1, z: 1.5, type: 'steering' },
            { id: 2, z: -1.5, type: 'single' }
        ]
    },
    VUC: {
        chassisLength: 4.2,
        axles: [
            { id: 1, z: 1.5, type: 'steering' },
            { id: 2, z: -1.5, type: 'single' }
        ]
    },
    TOCO: {
        chassisLength: 4.5,
        axles: [
            { id: 1, z: 1.8, type: 'steering' },
            { id: 2, z: -1.5, type: 'double' }
        ]
    },
    TRUCK: {
        chassisLength: 5.5,
        axles: [
            { id: 1, z: 2.0, type: 'steering' },
            { id: 2, z: -0.5, type: 'double' },
            { id: 3, z: -1.8, type: 'double' }
        ]
    },
    BITRUCK: {
        chassisLength: 6.5,
        axles: [
            { id: 1, z: 2.5, type: 'steering' },
            { id: 2, z: 1.5, type: 'steering' },
            { id: 3, z: -0.8, type: 'double' },
            { id: 4, z: -2.0, type: 'double' }
        ]
    },
    CAVALO_2E: {
        chassisLength: 7.0,
        axles: [
            { id: 1, z: 2.8, type: 'steering' },
            { id: 2, z: 1.6, type: 'double' },
            { id: 3, z: -1.2, type: 'single' },
            { id: 4, z: -2.4, type: 'single' }
        ]
    },
    CAVALO_3E: {
        chassisLength: 8.0,
        axles: [
            { id: 1, z: 3.2, type: 'steering' },
            { id: 2, z: 2.0, type: 'double' },
            { id: 3, z: -0.5, type: 'double' },
            { id: 4, z: -1.8, type: 'double' },
            { id: 5, z: -3.0, type: 'double' }
        ]
    },
    BITREM: {
        chassisLength: 10.0,
        axles: [
            { id: 1, z: 4.5, type: 'steering' },
            { id: 2, z: 3.2, type: 'double' },
            { id: 3, z: 1.5, type: 'double' },
            { id: 4, z: 0.2, type: 'double' },
            { id: 5, z: -1.5, type: 'double' },
            { id: 6, z: -2.8, type: 'double' },
            { id: 7, z: -4.0, type: 'double' }
        ]
    },
    RODOTREM: {
        chassisLength: 12.0,
        axles: [
            { id: 1, z: 5.5, type: 'steering' },
            { id: 2, z: 4.2, type: 'double' },
            { id: 3, z: 2.5, type: 'double' },
            { id: 4, z: 1.2, type: 'double' },
            { id: 5, z: -0.5, type: 'double' },
            { id: 6, z: -1.8, type: 'double' },
            { id: 7, z: -3.5, type: 'double' },
            { id: 8, z: -4.8, type: 'double' },
            { id: 9, z: -6.0, type: 'double' }
        ]
    }
};

export function TyreModel({ position, pneu, isActive, onSelect }: any) {
    const isPlaceholder = !pneu.id;
    const depth = pneu?.tread_depth_mm || 0;

    let color = '#475569'; // slate-600 (default/placeholder)
    if (!isPlaceholder) {
        color = '#10b981'; // emerald-500
        if (depth <= 1.6) color = '#f43f5e'; // rose-500
        else if (depth <= 3.0) color = '#f59e0b'; // amber-500
    }

    return (
        <group position={position} onClick={(e) => { e.stopPropagation(); onSelect(pneu); }}>
            {/* Pneu */}
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
                <cylinderGeometry args={[0.5, 0.5, 0.32, 40]} />
                <meshStandardMaterial
                    color={isActive ? '#137fec' : (isPlaceholder ? '#334155' : '#111827')}
                    roughness={0.9}
                    transparent={isPlaceholder}
                    opacity={isPlaceholder ? 0.7 : 1}
                    emissive={isActive ? '#137fec' : (isPlaceholder ? '#1e293b' : color)}
                    emissiveIntensity={isActive ? 0.6 : 0.15}
                />
            </mesh>

            {/* Aro (Rim) */}
            <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.28, 0.28, 0.34, 16]} />
                <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.15} />
            </mesh>

            {/* Hubcap (Central) */}
            <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]}>
                <cylinderGeometry args={[0.1, 0.1, 0.36, 16]} />
                <meshStandardMaterial color="#1e293b" metalness={0.5} />
            </mesh>

            {/* Label de Posição */}
            <Text
                position={[0, 0.75, 0]}
                fontSize={0.25}
                color="#0f172a"
                anchorX="center"
                anchorY="middle"
                fontWeight="black"
            >
                {pneu?.position}
            </Text>
        </group>
    );
}

function ResizeHandler() {
    const { gl, invalidate } = useThree();
    useEffect(() => {
        const timer = setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
            invalidate();
        }, 100);
        return () => clearTimeout(timer);
    }, [gl, invalidate]);
    return null;
}

export function TruckScene3D({ pneus, activeTyre, onSelect, vehicleType }: any) {
    const config = TRUCK_LAYOUTS[vehicleType] || TRUCK_LAYOUTS.TRUCK;
    const { chassisLength, axles } = config;

    return (
        <Canvas
            shadows
            frameloop="always"
            dpr={[1, 2]}
            gl={{
                antialias: true,
                alpha: true,
                preserveDrawingBuffer: true
            }}
            camera={{ position: [8, 5, 8], fov: 40 }}
            className="w-full h-full"
        >
            <color attach="background" args={['#f1f5f9']} />
            <OrbitControls
                enablePan={false}
                minDistance={5}
                maxDistance={15}
                maxPolarAngle={Math.PI / 1.8}
                target={[0, 0, 0]}
                makeDefault
            />

            <ambientLight intensity={1.5} />
            <spotLight
                position={[15, 15, 15]}
                angle={0.2}
                penumbra={1}
                intensity={800}
                castShadow
                shadow-mapSize-width={1024}
                shadow-mapSize-height={1024}
                shadow-bias={-0.0001}
            />
            <directionalLight position={[-5, 5, -5]} intensity={2.5} color="#137fec" />

            <Float speed={1.2} rotationIntensity={0.05} floatIntensity={0.2}>
                <group rotation={[0, -Math.PI / 4, 0]} position={[0, 0, 0]}>
                    {/* Chassi - Longarinas */}
                    <mesh position={[0.4, 0.5, 0]} castShadow receiveShadow>
                        <boxGeometry args={[0.15, 0.25, chassisLength]} />
                        <meshStandardMaterial color="#020617" metalness={0.8} roughness={0.2} />
                    </mesh>
                    <mesh position={[-0.4, 0.5, 0]} castShadow receiveShadow>
                        <boxGeometry args={[0.15, 0.25, chassisLength]} />
                        <meshStandardMaterial color="#020617" metalness={0.8} roughness={0.2} />
                    </mesh>

                    {/* Eixos e Pneus */}
                    {axles.map((axle: any) => {
                        const isDouble = axle.type === 'double';

                        return (
                            <group key={axle.id} position={[0, 0.25, axle.z]}>
                                {/* Eixo Físico */}
                                <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                                    <cylinderGeometry args={[0.08, 0.08, 2.4, 16]} />
                                    <meshStandardMaterial color="#0f172a" metalness={0.8} />
                                </mesh>

                                {/* Diferencial */}
                                {isDouble && (
                                    <mesh castShadow position={[0, 0, 0]}>
                                        <sphereGeometry args={[0.28, 20, 20]} />
                                        <meshStandardMaterial color="#020617" metalness={0.9} roughness={0.1} />
                                    </mesh>
                                )}

                                {/* Pneus */}
                                {isDouble ? (
                                    // 4 Pneus — E (Esquerdo) em x positivo, D (Direito) em x negativo
                                    // (câmera em [8,5,8] inverte o eixo X visualmente)
                                    <>
                                        <TireWithData pos={`${axle.id}EE`} x={1.3} pneus={pneus} activeTyre={activeTyre} onSelect={onSelect} />
                                        <TireWithData pos={`${axle.id}IE`} x={0.9} pneus={pneus} activeTyre={activeTyre} onSelect={onSelect} />
                                        <TireWithData pos={`${axle.id}ID`} x={-0.9} pneus={pneus} activeTyre={activeTyre} onSelect={onSelect} />
                                        <TireWithData pos={`${axle.id}ED`} x={-1.3} pneus={pneus} activeTyre={activeTyre} onSelect={onSelect} />
                                    </>
                                ) : (
                                    // 2 Pneus — E em x positivo, D em x negativo
                                    <>
                                        <TireWithData pos={`${axle.id}E`} x={1.2} pneus={pneus} activeTyre={activeTyre} onSelect={onSelect} />
                                        <TireWithData pos={`${axle.id}D`} x={-1.2} pneus={pneus} activeTyre={activeTyre} onSelect={onSelect} />
                                    </>
                                )}
                            </group>
                        );
                    })}
                </group>
            </Float>

            <ContactShadows position={[0, -0.3, 0]} opacity={0.6} scale={15} blur={2} far={3} color="#000000" />
            <ResizeHandler />
        </Canvas>
    );
}

function TireWithData({ pos, x, pneus, activeTyre, onSelect }: any) {
    const pneu = pneus.find((p: any) => p.position === pos) || { position: pos, tread_depth_mm: 0 };

    return (
        <Suspense fallback={null}>
            <TyreModel
                position={[x, 0, 0]}
                pneu={pneu}
                isActive={activeTyre?.position === pos}
                onSelect={onSelect}
            />
        </Suspense>
    );
}
