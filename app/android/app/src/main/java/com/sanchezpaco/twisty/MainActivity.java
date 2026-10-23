package com.sanchezpaco.twisty;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OpenInPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
