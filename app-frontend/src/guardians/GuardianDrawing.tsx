import { useMemo, useRef } from 'react';
import { PanResponder, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { drawingPoint, type DrawingStroke } from './guardian';


export function GuardianArtwork({ strokes }: { strokes: DrawingStroke[] }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 300 300" pointerEvents="none" accessible={false}>
      <Rect width="300" height="300" fill="white" />
      {strokes.map((stroke, index) => stroke.points.length === 1 ? (
        <Circle key={index} cx={stroke.points[0].x} cy={stroke.points[0].y} r={3} fill={stroke.color} />
      ) : (
        <Path key={index} d={stroke.points.map((point, i) => `${i === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ')}
          stroke={stroke.color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
    </Svg>
  );
}

interface DrawingProps {
  strokes: DrawingStroke[];
  color: string;
  onChange: (strokes: DrawingStroke[]) => void;
}


export default function GuardianDrawing({ strokes, color, onChange }: DrawingProps) {
  const size = useRef(0);
  const current = useRef({ strokes, color, onChange });
  current.current = { strokes, color, onChange };
  const active = useRef<number | null>(null);
  const start = useRef({ x: 0, y: 0 });

  const responder = useMemo(() => {
    function update(next: DrawingStroke[]) {
      current.current.strokes = next;
      current.current.onChange(next);
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: event => {
        if (size.current <= 0) return;
        start.current = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
        active.current = current.current.strokes.length;
        update([...current.current.strokes, {
          color: current.current.color,
          points: [drawingPoint(start.current.x, start.current.y, size.current)],
        }]);
      },
      onPanResponderMove: (_event, gesture) => {
        const index = active.current;
        if (index === null || size.current <= 0) return;
        const stroke = current.current.strokes[index];
        if (!stroke) return;
        const point = drawingPoint(start.current.x + gesture.dx, start.current.y + gesture.dy, size.current);
        const last = stroke.points[stroke.points.length - 1];
        if (Math.abs(point.x - last.x) + Math.abs(point.y - last.y) < 1) return;
        const next = [...current.current.strokes];
        next[index] = { ...stroke, points: [...stroke.points, point] };
        update(next);
      },
      onPanResponderRelease: () => { active.current = null; },
      onPanResponderTerminate: () => { active.current = null; },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    });
  }, []);

  return (
    <View testID="guardian-drawing-area" accessibilityLabel="Guardian drawing area"
      accessibilityHint="Draw with your mouse or finger. Use Undo or Clear art to correct strokes."
      style={[styles.canvas, Platform.OS === 'web' && { touchAction: 'none' } as ViewStyle]}
      onLayout={event => { size.current = event.nativeEvent.layout.width; }}
      {...responder.panHandlers}>
      <GuardianArtwork strokes={strokes} />
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { width: '100%', aspectRatio: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#777777', overflow: 'hidden' },
});
