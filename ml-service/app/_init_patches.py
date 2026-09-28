def _apply_unpickle_support() -> None:
    try:
        from sklearn.compose import _column_transformer as _ct_mod

        if not hasattr(_ct_mod, "_RemainderColsList"):
            class _RemainderColsList(list):
                pass

            _ct_mod._RemainderColsList = _RemainderColsList
    except Exception:
        pass


_apply_unpickle_support()
