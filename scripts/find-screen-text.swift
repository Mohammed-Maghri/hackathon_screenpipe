import AppKit
import CoreGraphics
import Foundation
import ScreenCaptureKit
import Vision

guard CommandLine.arguments.count == 2 else {
    fputs("Usage: find-screen-text <visible phrase>\n", stderr)
    Foundation.exit(2)
}
let content = try await SCShareableContent.excludingDesktopWindows(false,
                                                                    onScreenWindowsOnly: true)
guard let display = content.displays.first else { Foundation.exit(2) }
let filter = SCContentFilter(display: display, excludingWindows: [])
let configuration = SCStreamConfiguration()
configuration.width = display.width
configuration.height = display.height
let image: CGImage = try await withCheckedThrowingContinuation { continuation in
    SCScreenshotManager.captureImage(contentFilter: filter, configuration: configuration) { image, error in
        if let error { continuation.resume(throwing: error) }
        else if let image { continuation.resume(returning: image) }
        else { continuation.resume(throwing: NSError(domain: "Screen capture failed", code: 1)) }
    }
}
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false
try VNImageRequestHandler(cgImage: image).perform([request])
let phrase = CommandLine.arguments[1].lowercased()
let bounds = CGDisplayBounds(display.displayID)
for observation in request.results ?? [] {
    guard let text = observation.topCandidates(1).first?.string,
          text.lowercased().contains(phrase) else { continue }
    let box = observation.boundingBox
    let x = Int(bounds.minX + box.midX * bounds.width)
    let y = Int(bounds.minY + (1 - box.midY) * bounds.height)
    print("\(x) \(y)")
    Foundation.exit(0)
}
Foundation.exit(1)
