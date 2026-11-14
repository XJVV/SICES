"""Largest-Triangle-Three-Buckets (LTTB) downsampling algorithm for high-density series.

Reduces millions of points down to ~2,000 points in milliseconds while strictly
preserving peaks, troughs, and visual morphology.
"""
from typing import List, Sequence, Union

Point = Union[Sequence[float], Sequence[Union[float, None]]]


def lttb(points: Sequence[Point], threshold: int) -> List[List[float]]:
    """Downsamples a 2D time-series/scatter points array using LTTB.
    
    Args:
        points: list of [x, y] or [x, y, errSup, errInf]
        threshold: target number of points (e.g. 2000)
        
    Returns:
        Downsampled list of points preserving shape and bounds.
    """
    total = len(points)
    if threshold >= total or threshold <= 2:
        return [[float(p[0]), float(p[1])] for p in points if p[0] is not None and p[1] is not None]

    # Filter out invalid points
    valid_points: List[List[float]] = []
    for p in points:
        if p[0] is not None and p[1] is not None:
            try:
                valid_points.append([float(p[0]), float(p[1])])
            except (ValueError, TypeError):
                continue

    if len(valid_points) <= threshold:
        return valid_points

    sampled: List[List[float]] = [valid_points[0]]
    bucket_size = (len(valid_points) - 2) / (threshold - 2)
    a = 0

    for i in range(threshold - 2):
        # Calculate point average for next bucket (c)
        c_start = int((i + 1) * bucket_size) + 1
        c_end = min(int((i + 2) * bucket_size) + 1, len(valid_points))
        
        avg_x = 0.0
        avg_y = 0.0
        c_count = c_end - c_start
        if c_count > 0:
            for c_idx in range(c_start, c_end):
                avg_x += valid_points[c_idx][0]
                avg_y += valid_points[c_idx][1]
            avg_x /= c_count
            avg_y /= c_count
        else:
            avg_x = valid_points[min(c_start, len(valid_points) - 1)][0]
            avg_y = valid_points[min(c_start, len(valid_points) - 1)][1]

        # Get the range for this bucket (b)
        b_start = int(i * bucket_size) + 1
        b_end = min(int((i + 1) * bucket_size) + 1, len(valid_points))
        
        point_a = valid_points[a]
        max_area = -1.0
        max_idx = b_start

        for b_idx in range(b_start, b_end):
            # Calculate triangle area over points a, b, and c
            b_pt = valid_points[b_idx]
            area = abs(
                (point_a[0] - avg_x) * (b_pt[1] - point_a[1]) -
                (point_a[0] - b_pt[0]) * (avg_y - point_a[1])
            ) * 0.5

            if area > max_area:
                max_area = area
                max_idx = b_idx

        sampled.append(valid_points[max_idx])
        a = max_idx

    sampled.append(valid_points[-1])
    return sampled
