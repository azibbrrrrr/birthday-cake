import { useCursor, useTexture } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  Box3,
  DoubleSide,
  Euler,
  Group,
  MeshStandardMaterial,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from "three";

type PictureFrameProps = {
  id?: string;
  image: string;
  imageScale?: number | [number, number];
  imageOffset?: [number, number, number];
  imageInset?: number;
  tablePosition?: [number, number, number];
  tableRotation?: [number, number, number];
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  isActive?: boolean;
  onToggle?: (id: string) => void;
  children?: ReactNode;
};

const DEFAULT_IMAGE_SCALE: [number, number] = [0.82, 0.82];
const CAMERA_DISTANCE = 1.2;
const CAMERA_Y_FLOOR = 0.8;
const HOVER_LIFT = 0.04;

export function PictureFrame({
  id,
  image,
  imageScale = DEFAULT_IMAGE_SCALE,
  imageOffset,
  tablePosition,
  tableRotation,
  isActive = false,
  onToggle,
  children,
  position,
  rotation,
  scale,
}: PictureFrameProps) {
  const groupRef = useRef<Group>(null);
  const { gl, camera } = useThree();
  const [isHovered, setIsHovered] = useState(false);

  useCursor((isHovered || isActive) && !!id && !!onToggle, "pointer");

  const gltf = useLoader(GLTFLoader, "/picture_frame.glb");
  const pictureTexture = useTexture(image);

  pictureTexture.colorSpace = SRGBColorSpace;
  const maxAnisotropy =
    typeof gl.capabilities.getMaxAnisotropy === "function"
      ? gl.capabilities.getMaxAnisotropy()
      : 1;
  pictureTexture.anisotropy = maxAnisotropy;

  const frameScene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  const { frameSize, frameCenter } = useMemo(() => {
    const box = new Box3().setFromObject(frameScene);
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);
    return { frameSize: size, frameCenter: center };
  }, [frameScene]);

  const scaledImage = useMemo<[number, number]>(() => {
    if (Array.isArray(imageScale)) {
      return imageScale;
    }
    return [imageScale, imageScale];
  }, [imageScale]);

  const [imageScaleX, imageScaleY] = scaledImage;
  const imageWidth = frameSize.x * imageScaleX;
  const imageHeight = frameSize.y * imageScaleY;

  const [offsetX, offsetY, offsetZ] = imageOffset ?? [0, 0.05, -0.27];

  const imagePosition: [number, number, number] = [
    frameCenter.x + offsetX,
    frameCenter.y + offsetY,
    frameCenter.z + offsetZ,
  ];

  const pictureMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        map: pictureTexture,
        roughness: 0.08,
        metalness: 0,
        side: DoubleSide,
      }),
    [pictureTexture]
  );

  useEffect(() => {
    return () => {
      pictureMaterial.dispose();
    };
  }, [pictureMaterial]);

  // For interactive frames, use tablePosition/tableRotation; otherwise use position/rotation props
  const defaultPosition = useMemo(() => {
    if (tablePosition) {
      return new Vector3(...tablePosition);
    }
    if (Array.isArray(position)) {
      return new Vector3(...position);
    }
    return new Vector3(0, 0, 0);
  }, [tablePosition, position]);

  const defaultQuaternion = useMemo(() => {
    const rot = tableRotation || rotation;
    if (rot && Array.isArray(rot)) {
      const euler = new Euler(...rot);
      return new Quaternion().setFromEuler(euler);
    }
    return new Quaternion();
  }, [tableRotation, rotation]);

  const defaultScale = useMemo(() => {
    if (typeof scale === "number") {
      return new Vector3(scale, scale, scale);
    }
    return new Vector3(1, 1, 1);
  }, [scale]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) {
      return;
    }
    group.position.copy(defaultPosition);
    group.quaternion.copy(defaultQuaternion);
    group.scale.copy(defaultScale);
  }, [defaultPosition, defaultQuaternion, defaultScale]);

  useEffect(() => {
    if (!isActive) {
      setIsHovered(false);
    }
  }, [isActive]);

  const tmpPosition = useMemo(() => new Vector3(), []);
  const tmpQuaternion = useMemo(() => new Quaternion(), []);
  const tmpDirection = useMemo(() => new Vector3(), []);
  const cameraOffset = useMemo(() => new Vector3(0, 0.10, 0), []);
  const yFlipQuaternion = useMemo(() => new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI), []);
  // Pitch correction to counteract the 0.04 radian forward tilt in the inner group
  const pitchCorrection = useMemo(() => new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -0.35), []);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group || !id || !onToggle) {
      return;
    }

    const positionTarget = tmpPosition;
    const rotationTarget = tmpQuaternion;

    if (isActive) {
      positionTarget.copy(camera.position);
      positionTarget.add(
        tmpDirection
          .copy(camera.getWorldDirection(tmpDirection))
          .multiplyScalar(CAMERA_DISTANCE)
      );
      positionTarget.add(cameraOffset);
      if (positionTarget.y < CAMERA_Y_FLOOR) {
        positionTarget.y = CAMERA_Y_FLOOR;
      }

      // Copy camera rotation, flip 180 degrees, and apply pitch correction for straight view
      rotationTarget.copy(camera.quaternion);
      rotationTarget.multiply(yFlipQuaternion);
      rotationTarget.multiply(pitchCorrection);
    } else {
      positionTarget.copy(defaultPosition);
      if (isHovered) {
        positionTarget.y += HOVER_LIFT;
      }
      rotationTarget.copy(defaultQuaternion);
    }

    const lerpAlpha = 1 - Math.exp(-delta * 12);
    const slerpAlpha = 1 - Math.exp(-delta * 10);

    group.position.lerp(positionTarget, lerpAlpha);
    group.quaternion.slerp(rotationTarget, slerpAlpha);
  });

  const handlePointerOver = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!id || !onToggle) return;
      event.stopPropagation();
      if (!isActive) {
        setIsHovered(true);
      }
    },
    [isActive, id, onToggle]
  );

  const handlePointerOut = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!id || !onToggle) return;
      event.stopPropagation();
      setIsHovered(false);
    },
    [id, onToggle]
  );

  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!id || !onToggle) return;
      event.stopPropagation();
    },
    [id, onToggle]
  );

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (!id || !onToggle) return;
      event.stopPropagation();
      onToggle(id);
    },
    [id, onToggle]
  );

  const isInteractive = !!id && !!onToggle;

  return (
    <group ref={groupRef}>
      <group rotation={[0.04, 0, 0]}>
        <primitive object={frameScene} />
        <mesh
          position={imagePosition}
          rotation={[0.435, Math.PI, 0]}
          material={pictureMaterial}
          onPointerOver={isInteractive ? handlePointerOver : undefined}
          onPointerOut={isInteractive ? handlePointerOut : undefined}
          onPointerDown={isInteractive ? handlePointerDown : undefined}
          onClick={isInteractive ? handleClick : undefined}
        >
          <planeGeometry args={[imageWidth, imageHeight]} />
        </mesh>
        {children}
      </group>
    </group>
  );
}
