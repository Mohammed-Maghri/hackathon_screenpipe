import CoreGraphics
import Foundation

func clamp(_ value: CGFloat, _ low: CGFloat, _ high: CGFloat) -> CGFloat {
    min(max(value, low), high)
}

func cubic(_ p0: CGPoint, _ p1: CGPoint, _ p2: CGPoint,
           _ p3: CGPoint, _ t: CGFloat) -> CGPoint {
    let u = 1 - t
    let a = u * u * u
    let b = 3 * u * u * t
    let c = 3 * u * t * t
    let d = t * t * t
    return CGPoint(x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
                   y: a * p0.y + b * p1.y + c * p2.y + d * p3.y)
}

func postMove(_ point: CGPoint) {
    CGWarpMouseCursorPosition(point)
    let event = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved,
                        mouseCursorPosition: point, mouseButton: .left)
    event?.post(tap: .cghidEventTap)
}

func movePointer(to target: CGPoint, display: CGRect) {
    let start = CGEvent(source: nil)?.location ?? target
    let end = CGPoint(x: clamp(target.x, display.minX, display.maxX - 1),
                      y: clamp(target.y, display.minY, display.maxY - 1))
    let dx = end.x - start.x
    let dy = end.y - start.y
    let distance = hypot(dx, dy)
    guard distance > 3 else { return }

    var random = SystemRandomNumberGenerator()
    let duration = clamp(distance / 1150 + CGFloat.random(in: 0.08...0.18,
                                                          using: &random),
                         0.34, 1.25)
    let bend = CGFloat.random(in: -1...1, using: &random)
        * min(max(distance * 0.035, 5), 38)
    let normal = CGPoint(x: -dy / distance, y: dx / distance)
    let control1 = CGPoint(x: start.x + dx / 3 + normal.x * bend,
                           y: start.y + dy / 3 + normal.y * bend)
    let control2 = CGPoint(x: start.x + dx * 2 / 3 + normal.x * bend * 0.55,
                           y: start.y + dy * 2 / 3 + normal.y * bend * 0.55)
    let frameCount = max(20, Int(duration * 60))
    let frameDelay = duration / Double(frameCount)

    for frame in 1...frameCount {
        let t = CGFloat(frame) / CGFloat(frameCount)
        let eased = t * t * (3 - 2 * t)
        postMove(cubic(start, control1, control2, end, eased))
        Thread.sleep(forTimeInterval: frameDelay)
    }
    postMove(end)
    print(String(format: "Moved %.0f px in %.2f s", distance, duration))
}

let args = CommandLine.arguments
if args.count < 3 || args.count > 5 {
    fputs("Usage: natural-cursor <x> <y> [--click] [--scroll <lines>]\n", stderr)
    exit(2)
}
guard let x = Double(args[1]), let y = Double(args[2]) else {
    fputs("Coordinates must be numbers.\n", stderr)
    exit(2)
}
let display = CGDisplayBounds(CGMainDisplayID())
movePointer(to: CGPoint(x: x, y: y), display: display)
if args.contains("--click") {
    Thread.sleep(forTimeInterval: Double.random(in: 0.28...0.46))
    for type in [CGEventType.leftMouseDown, .leftMouseUp] {
        let event = CGEvent(mouseEventSource: nil, mouseType: type,
                            mouseCursorPosition: CGPoint(x: x, y: y),
                            mouseButton: .left)
        event?.post(tap: .cghidEventTap)
        Thread.sleep(forTimeInterval: 0.1)
    }
}
if let index = args.firstIndex(of: "--scroll"), args.count > index + 1,
   let lines = Int32(args[index + 1]) {
    let event = CGEvent(scrollWheelEvent2Source: nil, units: .line,
                        wheelCount: 1, wheel1: lines, wheel2: 0, wheel3: 0)
    event?.location = CGPoint(x: x, y: y)
    event?.post(tap: .cghidEventTap)
}
