/**
 * Built-in sample data, used when the files in data/ are missing.
 * Same format as the data contract (see field-data.ts). ALL VALUES ARE SIMULATED.
 * Fictional fields in Trans-Nzoia, Kenya; two planted problem fields:
 *  - FS-104 drops for the last 3 weeks while neighbors stay steady (large drop)
 *  - FS-112 shows a smaller drop
 * Rain stops ~11 days before the last date (dry spell).
 */
import type { FieldDataPayload } from "./field-data";

export const BUILTIN_FIELD_DATA: FieldDataPayload = {
 "origin": "built_in",
 "fields": [
  {
   "id": "FS-101",
   "name": "Kapsara West Block",
   "farm": "Kapsara Farm",
   "growthStage": "V10 (10-leaf)",
   "boundary": [
    [
     1.04697,
     35.007122
    ],
    [
     1.047258,
     35.009175
    ],
    [
     1.048485,
     35.008962
    ],
    [
     1.048232,
     35.006975
    ]
   ],
   "readings": [
    {
     "date": "2026-08-17",
     "greenness": 0.55,
     "source": "simulated"
    },
    {
     "date": "2026-08-24",
     "greenness": 0.6,
     "source": "simulated"
    },
    {
     "date": "2026-08-31",
     "greenness": 0.64,
     "source": "simulated"
    },
    {
     "date": "2026-09-07",
     "greenness": 0.68,
     "source": "simulated"
    },
    {
     "date": "2026-09-14",
     "greenness": 0.7,
     "source": "simulated"
    },
    {
     "date": "2026-09-21",
     "greenness": 0.72,
     "source": "simulated"
    },
    {
     "date": "2026-09-28",
     "greenness": 0.72,
     "source": "simulated"
    },
    {
     "date": "2026-10-05",
     "greenness": 0.73,
     "source": "simulated"
    },
    {
     "date": "2026-10-12",
     "greenness": 0.72,
     "source": "simulated"
    },
    {
     "date": "2026-10-19",
     "greenness": 0.73,
     "source": "simulated"
    }
   ]
  },
  {
   "id": "FS-104",
   "name": "Kapsara East Block",
   "farm": "Kapsara Farm",
   "growthStage": "V12 (approaching tasseling)",
   "boundary": [
    [
     1.046702,
     35.012227
    ],
    [
     1.046245,
     35.014375
    ],
    [
     1.047728,
     35.014646
    ],
    [
     1.048199,
     35.012579
    ]
   ],
   "readings": [
    {
     "date": "2026-08-17",
     "greenness": 0.56,
     "source": "simulated"
    },
    {
     "date": "2026-08-24",
     "greenness": 0.61,
     "source": "simulated"
    },
    {
     "date": "2026-08-31",
     "greenness": 0.66,
     "source": "simulated"
    },
    {
     "date": "2026-09-07",
     "greenness": 0.69,
     "source": "simulated"
    },
    {
     "date": "2026-09-14",
     "greenness": 0.71,
     "source": "simulated"
    },
    {
     "date": "2026-09-21",
     "greenness": 0.71,
     "source": "simulated"
    },
    {
     "date": "2026-09-28",
     "greenness": 0.72,
     "source": "simulated"
    },
    {
     "date": "2026-10-05",
     "greenness": 0.66,
     "source": "simulated"
    },
    {
     "date": "2026-10-12",
     "greenness": 0.61,
     "source": "simulated"
    },
    {
     "date": "2026-10-19",
     "greenness": 0.56,
     "source": "simulated"
    }
   ]
  },
  {
   "id": "FS-107",
   "name": "Kapsara River Strip",
   "farm": "Kapsara Farm",
   "growthStage": "V9 (9-leaf)",
   "boundary": [
    [
     1.048823,
     35.010973
    ],
    [
     1.049699,
     35.012852
    ],
    [
     1.050246,
     35.012552
    ],
    [
     1.049411,
     35.010732
    ]
   ],
   "readings": [
    {
     "date": "2026-08-17",
     "greenness": 0.5,
     "source": "simulated"
    },
    {
     "date": "2026-08-24",
     "greenness": 0.55,
     "source": "simulated"
    },
    {
     "date": "2026-08-31",
     "greenness": 0.58,
     "source": "simulated"
    },
    {
     "date": "2026-09-07",
     "greenness": 0.6,
     "source": "simulated"
    },
    {
     "date": "2026-09-14",
     "greenness": 0.61,
     "source": "simulated"
    },
    {
     "date": "2026-09-21",
     "greenness": 0.62,
     "source": "simulated"
    },
    {
     "date": "2026-09-28",
     "greenness": 0.62,
     "source": "simulated"
    },
    {
     "date": "2026-10-05",
     "greenness": 0.63,
     "source": "simulated"
    },
    {
     "date": "2026-10-12",
     "greenness": 0.62,
     "source": "simulated"
    },
    {
     "date": "2026-10-19",
     "greenness": 0.62,
     "source": "simulated"
    }
   ]
  },
  {
   "id": "FS-112",
   "name": "Saboti Upper Field",
   "farm": "Saboti Ridge Farm",
   "growthStage": "V11 (11-leaf)",
   "boundary": [
    [
     1.040994,
     34.984545
    ],
    [
     1.040858,
     34.986094
    ],
    [
     1.042101,
     34.986173
    ],
    [
     1.042257,
     34.984679
    ]
   ],
   "readings": [
    {
     "date": "2026-08-17",
     "greenness": 0.54,
     "source": "simulated"
    },
    {
     "date": "2026-08-24",
     "greenness": 0.6,
     "source": "simulated"
    },
    {
     "date": "2026-08-31",
     "greenness": 0.65,
     "source": "simulated"
    },
    {
     "date": "2026-09-07",
     "greenness": 0.68,
     "source": "simulated"
    },
    {
     "date": "2026-09-14",
     "greenness": 0.7,
     "source": "simulated"
    },
    {
     "date": "2026-09-21",
     "greenness": 0.7,
     "source": "simulated"
    },
    {
     "date": "2026-09-28",
     "greenness": 0.71,
     "source": "simulated"
    },
    {
     "date": "2026-10-05",
     "greenness": 0.69,
     "source": "simulated"
    },
    {
     "date": "2026-10-12",
     "greenness": 0.67,
     "source": "simulated"
    },
    {
     "date": "2026-10-19",
     "greenness": 0.65,
     "source": "simulated"
    }
   ]
  },
  {
   "id": "FS-115",
   "name": "Saboti Lower Field",
   "farm": "Saboti Ridge Farm",
   "growthStage": "V11 (11-leaf)",
   "boundary": [
    [
     1.038059,
     34.987682
    ],
    [
     1.038565,
     34.989714
    ],
    [
     1.039639,
     34.989403
    ],
    [
     1.039172,
     34.987436
    ]
   ],
   "readings": [
    {
     "date": "2026-08-17",
     "greenness": 0.53,
     "source": "simulated"
    },
    {
     "date": "2026-08-24",
     "greenness": 0.59,
     "source": "simulated"
    },
    {
     "date": "2026-08-31",
     "greenness": 0.64,
     "source": "simulated"
    },
    {
     "date": "2026-09-07",
     "greenness": 0.66,
     "source": "simulated"
    },
    {
     "date": "2026-09-14",
     "greenness": 0.67,
     "source": "simulated"
    },
    {
     "date": "2026-09-21",
     "greenness": 0.68,
     "source": "simulated"
    },
    {
     "date": "2026-09-28",
     "greenness": 0.69,
     "source": "simulated"
    },
    {
     "date": "2026-10-05",
     "greenness": 0.69,
     "source": "simulated"
    },
    {
     "date": "2026-10-12",
     "greenness": 0.7,
     "source": "simulated"
    },
    {
     "date": "2026-10-19",
     "greenness": 0.7,
     "source": "simulated"
    }
   ]
  },
  {
   "id": "FS-118",
   "name": "Saboti Hillside",
   "farm": "Saboti Ridge Farm",
   "growthStage": "V10 (10-leaf)",
   "boundary": [
    [
     1.041676,
     34.988628
    ],
    [
     1.042202,
     34.989539
    ],
    [
     1.042988,
     34.989062
    ],
    [
     1.042496,
     34.988172
    ]
   ],
   "readings": [
    {
     "date": "2026-08-17",
     "greenness": 0.5,
     "source": "simulated"
    },
    {
     "date": "2026-08-24",
     "greenness": 0.56,
     "source": "simulated"
    },
    {
     "date": "2026-08-31",
     "greenness": 0.61,
     "source": "simulated"
    },
    {
     "date": "2026-09-07",
     "greenness": 0.65,
     "source": "simulated"
    },
    {
     "date": "2026-09-14",
     "greenness": 0.68,
     "source": "simulated"
    },
    {
     "date": "2026-09-21",
     "greenness": 0.7,
     "source": "simulated"
    },
    {
     "date": "2026-09-28",
     "greenness": 0.71,
     "source": "simulated"
    },
    {
     "date": "2026-10-05",
     "greenness": 0.71,
     "source": "simulated"
    },
    {
     "date": "2026-10-12",
     "greenness": 0.7,
     "source": "simulated"
    },
    {
     "date": "2026-10-19",
     "greenness": 0.71,
     "source": "simulated"
    }
   ]
  },
  {
   "id": "FS-121",
   "name": "Kiminini North",
   "farm": "Kiminini Plots",
   "growthStage": "V10 (10-leaf)",
   "boundary": [
    [
     1.024839,
     34.993451
    ],
    [
     1.024296,
     34.994943
    ],
    [
     1.025262,
     34.995261
    ],
    [
     1.025805,
     34.993828
    ]
   ],
   "readings": [
    {
     "date": "2026-08-17",
     "greenness": 0.51,
     "source": "simulated"
    },
    {
     "date": "2026-08-24",
     "greenness": 0.57,
     "source": "simulated"
    },
    {
     "date": "2026-08-31",
     "greenness": 0.62,
     "source": "simulated"
    },
    {
     "date": "2026-09-07",
     "greenness": 0.66,
     "source": "simulated"
    },
    {
     "date": "2026-09-14",
     "greenness": 0.69,
     "source": "simulated"
    },
    {
     "date": "2026-09-21",
     "greenness": 0.7,
     "source": "simulated"
    },
    {
     "date": "2026-09-28",
     "greenness": 0.71,
     "source": "simulated"
    },
    {
     "date": "2026-10-05",
     "greenness": 0.72,
     "source": "simulated"
    },
    {
     "date": "2026-10-12",
     "greenness": 0.72,
     "source": "simulated"
    },
    {
     "date": "2026-10-19",
     "greenness": 0.72,
     "source": "simulated"
    }
   ]
  },
  {
   "id": "FS-124",
   "name": "Kiminini South",
   "farm": "Kiminini Plots",
   "growthStage": "V11 (11-leaf)",
   "boundary": [
    [
     1.021444,
     34.996452
    ],
    [
     1.021566,
     34.997848
    ],
    [
     1.022595,
     34.99773
    ],
    [
     1.022498,
     34.99638
    ]
   ],
   "readings": [
    {
     "date": "2026-08-17",
     "greenness": 0.53,
     "source": "simulated"
    },
    {
     "date": "2026-08-24",
     "greenness": 0.58,
     "source": "simulated"
    },
    {
     "date": "2026-08-31",
     "greenness": 0.62,
     "source": "simulated"
    },
    {
     "date": "2026-09-07",
     "greenness": 0.64,
     "source": "simulated"
    },
    {
     "date": "2026-09-14",
     "greenness": 0.63,
     "source": "simulated"
    },
    {
     "date": "2026-09-21",
     "greenness": 0.64,
     "source": "simulated"
    },
    {
     "date": "2026-09-28",
     "greenness": 0.65,
     "source": "simulated"
    },
    {
     "date": "2026-10-05",
     "greenness": 0.66,
     "source": "simulated"
    },
    {
     "date": "2026-10-12",
     "greenness": 0.67,
     "source": "simulated"
    },
    {
     "date": "2026-10-19",
     "greenness": 0.67,
     "source": "simulated"
    }
   ]
  }
 ],
 "weather": [
  {
   "date": "2026-09-19",
   "rainfallMm": 4.2
  },
  {
   "date": "2026-09-20",
   "rainfallMm": 0
  },
  {
   "date": "2026-09-21",
   "rainfallMm": 12.5
  },
  {
   "date": "2026-09-22",
   "rainfallMm": 6.1
  },
  {
   "date": "2026-09-23",
   "rainfallMm": 0
  },
  {
   "date": "2026-09-24",
   "rainfallMm": 0
  },
  {
   "date": "2026-09-25",
   "rainfallMm": 8.4
  },
  {
   "date": "2026-09-26",
   "rainfallMm": 15.2
  },
  {
   "date": "2026-09-27",
   "rainfallMm": 3.3
  },
  {
   "date": "2026-09-28",
   "rainfallMm": 0
  },
  {
   "date": "2026-09-29",
   "rainfallMm": 0
  },
  {
   "date": "2026-09-30",
   "rainfallMm": 5.6
  },
  {
   "date": "2026-10-01",
   "rainfallMm": 9.8
  },
  {
   "date": "2026-10-02",
   "rainfallMm": 0
  },
  {
   "date": "2026-10-03",
   "rainfallMm": 2.1
  },
  {
   "date": "2026-10-04",
   "rainfallMm": 11.0
  },
  {
   "date": "2026-10-05",
   "rainfallMm": 0
  },
  {
   "date": "2026-10-06",
   "rainfallMm": 0
  },
  {
   "date": "2026-10-07",
   "rainfallMm": 7.4
  },
  {
   "date": "2026-10-08",
   "rainfallMm": 4.0
  },
  {
   "date": "2026-10-09",
   "rainfallMm": 1.2
  },
  {
   "date": "2026-10-10",
   "rainfallMm": 0
  },
  {
   "date": "2026-10-11",
   "rainfallMm": 0
  },
  {
   "date": "2026-10-12",
   "rainfallMm": 0
  },
  {
   "date": "2026-10-13",
   "rainfallMm": 0
  },
  {
   "date": "2026-10-14",
   "rainfallMm": 0
  },
  {
   "date": "2026-10-15",
   "rainfallMm": 0
  },
  {
   "date": "2026-10-16",
   "rainfallMm": 0
  },
  {
   "date": "2026-10-17",
   "rainfallMm": 0
  },
  {
   "date": "2026-10-18",
   "rainfallMm": 0
  },
  {
   "date": "2026-10-19",
   "rainfallMm": 0
  },
  {
   "date": "2026-10-20",
   "rainfallMm": 0
  },
  {
   "date": "2026-10-21",
   "rainfallMm": 0
  },
  {
   "date": "2026-10-22",
   "rainfallMm": 0
  },
  {
   "date": "2026-10-23",
   "rainfallMm": 0
  }
 ],
 "warnings": []
};
