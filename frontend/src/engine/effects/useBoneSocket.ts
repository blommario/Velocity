/**
 * React hook for attaching an Object3D to a named bone inside a SkinnedMesh hierarchy.
 *
 * Depends on: R3F, Three.js Bone/Object3D, devLogStore
 * Used by: SkeletalViewmodel (game layer)
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
 * Attachment is managed declaratively — changes to props trigger add/remove.
 */
export function useBoneSocket({
  root,
  boneName,
  attachment,
  offset,
  rotation,
}: UseBoneSocketProps): Bone | null {
  const boneRef = useRef<Bone | null>(null);

  // Find bone when root changes
  useEffect(() => {
    if (!root) {
      boneRef.current = null;
      return;
    }

    let found: Bone | null = null;
    const boneNames: string[] = [];

    root.traverse((child) => {
      // Bone check: Three.js Bone has isBone = true
      if ((child as Bone).isBone) {
        boneNames.push(child.name);
        if (child.name === boneName) {
          found = child as Bone;
        }
      }
    });

    if (found) {
      boneRef.current = found;
      devLog.info('BoneSocket', `Found bone "${boneName}"`);
    } else {
      boneRef.current = null;
      devLog.warn('BoneSocket', `Bone "${boneName}" not found. Available: [${boneNames.join(', ')}]`);
    }
  }, [root, boneName]);

  // Attach/detach when bone or attachment changes
  useEffect(() => {
    const bone = boneRef.current;
    if (!bone || !attachment) return;

    if (offset) {
      attachment.position.set(offset.x, offset.y, offset.z);
    }
    if (rotation) {
      attachment.rotation.set(rotation.x, rotation.y, rotation.z);
    }

    bone.add(attachment);
    devLog.info('BoneSocket', `Attached to "${boneName}"`);

    return () => {
      bone.remove(attachment);
      devLog.info('BoneSocket', `Detached from "${boneName}"`);
    };
  }, [boneRef.current, attachment, boneName, offset, rotation]);

  return boneRef.current;
}
