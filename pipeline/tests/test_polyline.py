import numpy as np

from twisty_pipeline import polyline


def test_matches_reference_encoding():
    # Reference example from Google's polyline documentation, given as (lat, lon).
    latlon = np.array([[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]])
    assert polyline.encode(latlon[:, ::-1]) == "_p~iF~ps|U_ulLnnqC_mqNvxq`@"


def test_round_trip():
    lonlat = np.array([[-3.70379, 40.41678], [-3.69, 40.42], [-4.1, 39.9]])
    np.testing.assert_allclose(polyline.decode(polyline.encode(lonlat)), lonlat, atol=1e-5)
