/**
 * React hook for attaching an Object3D to a named bone inside a SkinnedMesh hierarchy.
 *
 * Depends on: R3F, Three.js Bone/Object3D, devLogStore
 * Used by: SkeletalViewmodel (game layer), RemotePlayerWeapon (game layer)
 */
import { useRef, useEffect } from 'react';
import type { Group, Object3D, Bone } from 'three/webgpu';
import { devLog } from '../stores/devLogStore';

export interface UseBoneSocketProps {
  /** Root Group containing the SkinnedMesh with skeleton. */
  root: Group | null;
  /** Name of the bone to attach to (e.g. "hand.R"). */
  boneName: string;
  /** Object3D to attach as child of the bone. */
  attachment: Object3D | null;
  /** Local position offset from bone origin. */
  offset?: { x: number; y: number; z: number };
  /** Local rotation offset from bone (radians). */
  rotation?: { x: number; y: number; z: number };
}

/**
 * Finds a bone by name in the root hierarchy, attaches/detaches the given Object3D.
 * Attach/detach only depends on root, boneName, attachment identity.
 * Offset/rotation are applied via refs — no re-attach on value changes.
 */
export function useBoneSocket({
  root,
  boneName,
  attachment,
  offset,
  rotation,
}: UseBoneSocketProps): Bone | null {
  const boneRef = useRef<Bone | null>(null);
  const offsetRef = useRef(offset);
  const rotationRef = useRef(rotation);

  // Keep refs in sync without triggering attach/detach
  offsetRef.current = offset;
  rotationRef.current = rotation;

  // Apply offset/rotation changes without re-attaching
  useEffect(() => {
    if (!attachment) return;
    if (offset) {
      attachment.position.set(offset.x, offset.y, offset.z);
    }
    if (rotation) {
      attachment.rotation.set(rotation.x, rotation.y, rotation.z);
    }
  }, [attachment, offset, rotation]);

  // Find bone + attach/detach — only re-runs when identity of root/attachment changes
  useEffect(() => {
    if (!root) {
      boneRef.current = null;
      return;
    }

    const boneNames: string[] = [];
    let result: Bone | null = null;

    root.traverse((child) => {
      if ((child as Bone).isBone) {
        boneNames.push(child.name);
        if (child.name === boneName) {
          result = child as Bone;
        }
      }
    });

    // Re-assign to break TS closure narrowing (traverse runs synchronously)
    const bone: Bone | null = result;

    if (!bone) {
      boneRef.current = null;
      devLog.warn('BoneSocket', `Bone "${boneName}" not found. Available: [${boneNames.join(', ')}]`);
      return;
    }

    boneRef.current = bone;
    devLog.info('BoneSocket', `Found bone "${boneName}"`);

    if (!attachment) return;

    // Apply current offset/rotation from refs
    const off = offsetRef.current;
    const rot = rotationRef.current;
    if (off) {
      attachment.position.set(off.x, off.y, off.z);
    }
    if (rot) {
      attachment.rotation.set(rot.x, rot.y, rot.z);
    }

    bone.add(attachment);
    devLog.info('BoneSocket', `Attached to "${boneName}"`);

    return () => {
      bone.remove(attachment);
      devLog.info('BoneSocket', `Detached from "${boneName}"`);
    };
  }, [root, boneName, attachment]);

  return boneRef.current;
}
