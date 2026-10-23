from twisty_pipeline.places import Place, with_context


def test_small_places_get_the_nearest_town_as_context():
    places = [
        Place("Ademuz", "town", -1.2865, 40.0617),
        Place("Valencia", "city", -0.3763, 39.4699),
        Place("Los Santos", "hamlet", -1.2800, 40.1078),
    ]
    assert with_context(places)[2].context == "Ademuz"


def test_towns_keep_no_context_and_remote_places_get_none():
    places = [Place("Ademuz", "town", -1.2865, 40.0617), Place("Far away", "village", 3.0, 43.0)]
    assert [place.context for place in with_context(places)] == [None, None]


def test_villages_give_context_to_hamlets():
    places = [Place("Ademuz", "village", -1.2865, 40.0617), Place("Los Santos", "hamlet", -1.2800, 40.1078)]
    assert with_context(places)[1].context == "Ademuz"
