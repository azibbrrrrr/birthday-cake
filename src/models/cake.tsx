import { useCursor } from "@react-three/drei";
import { useLoader, type ThreeEvent } from "@react-three/fiber";
import type { ThreeElements } from "@react-three/fiber";
import { useCallback, useMemo, useState } from "react";
import type { Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type CakeProps = ThreeElements["group"] & {
  onClick?: () => void;
};

export function Cake({ children, onClick, ...groupProps }: CakeProps) {
  const gltf = useLoader(GLTFLoader, "/cake.glb");
  const cakeScene = useMemo<Group | null>(() => gltf.scene?.clone(true) ?? null, [gltf.scene]);
  const [isHovered, setIsHovered] = useState(false);

  useCursor(isHovered && !!onClick, "pointer");

  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (!onClick) return;
    event.stopPropagation();
    onClick();
  }, [onClick]);

  const handlePointerOver = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!onClick) return;
    event.stopPropagation();
    setIsHovered(true);
  }, [onClick]);

  const handlePointerOut = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!onClick) return;
    event.stopPropagation();
    setIsHovered(false);
  }, [onClick]);

  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!onClick) return;
    event.stopPropagation();
  }, [onClick]);

  if (!cakeScene) {
    return null;
  }

  return (
    <group {...groupProps}>
      <primitive object={cakeScene} />
      {onClick && (
        // Invisible mesh for click detection (cake is roughly 1.5 units wide/tall)
        <mesh
          position={[0, 0.5, 0]}
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onPointerDown={handlePointerDown}
        >
          <boxGeometry args={[1.5, 1, 1.5]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
      {children}
    </group>
  );
}
