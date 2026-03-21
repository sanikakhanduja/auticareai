"""
Generate JSON report from a video using the autism screening CV model.
Outputs JSON to stdout and optionally writes to a file.
"""

import argparse
import json
from autism_screening_model import AutismScreeningModel


def parse_args():
    parser = argparse.ArgumentParser(description="Generate JSON report from a video.")
    parser.add_argument("video_path", help="Path to input video file")
    parser.add_argument("--out", dest="output_path", help="Optional path to write JSON report")
    return parser.parse_args()


def main():
    args = parse_args()

    model = AutismScreeningModel()
    metrics = model.process_video(args.video_path)
    report = model.build_report(metrics)

    if args.output_path:
        with open(args.output_path, "w") as f:
            json.dump(report, f, indent=2)

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
